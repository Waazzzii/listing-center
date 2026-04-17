export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('lc_agent_actions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = getSupabase();
  const body = await req.json();
  const operation = body.operation as string;

  switch (operation) {
    case 'approve':
      return handleApprove(supabase, id, body);
    case 'reject':
      return handleReject(supabase, id, body);
    case 'execute':
      return handleExecute(supabase, id);
    case 'complete':
      return handleComplete(supabase, id, body);
    case 'fail':
      return handleFail(supabase, id, body);
    case 'revert':
      return handleRevert(supabase, id, body);
    case 'cancel':
      return handleCancel(supabase, id);
    default:
      return NextResponse.json({ message: `Unknown operation: ${operation}` }, { status: 400 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleApprove(supabase: any, id: string, body: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('lc_agent_actions')
    .update({
      status: 'approved',
      approved_by: body.approved_by || 'system',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'proposed')
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'Action not found or not in proposed status' }, { status: 404 });
  return NextResponse.json({ data });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleReject(supabase: any, id: string, body: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('lc_agent_actions')
    .update({
      status: 'cancelled',
      rejection_reason: body.reason || 'Rejected via API',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', ['proposed', 'approved', 'auto_approved'])
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'Action not found or already executed' }, { status: 404 });
  return NextResponse.json({ data });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleExecute(supabase: any, id: string) {
  // Mark as executing — actual execution happens in the executor module
  const { data, error } = await supabase
    .from('lc_agent_actions')
    .update({
      status: 'executing',
      executed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', ['approved', 'auto_approved'])
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'Action not found or not approved' }, { status: 404 });
  return NextResponse.json({ data });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleComplete(supabase: any, id: string, body: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('lc_agent_actions')
    .update({
      status: 'completed',
      execution_result: body.execution_result || {},
      measurement_due_at: body.measurement_due_at || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'executing')
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'Action not found or not executing' }, { status: 404 });
  return NextResponse.json({ data });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFail(supabase: any, id: string, body: Record<string, unknown>) {
  // Fetch current action to check retry count
  const { data: current } = await supabase
    .from('lc_agent_actions')
    .select('retry_count, max_retries')
    .eq('id', id)
    .single();

  const canRetry = current && current.retry_count < current.max_retries;

  const { data, error } = await supabase
    .from('lc_agent_actions')
    .update({
      status: canRetry ? 'approved' : 'failed',  // back to approved for retry, or failed
      execution_error: body.error || 'Unknown error',
      retry_count: (current?.retry_count || 0) + 1,
      executed_at: canRetry ? null : undefined,  // reset for retry
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'executing')
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data, retrying: canRetry });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRevert(supabase: any, id: string, body: Record<string, unknown>) {
  // Mark original action as reverted
  const { data: original, error: fetchErr } = await supabase
    .from('lc_agent_actions')
    .select('*')
    .eq('id', id)
    .eq('status', 'completed')
    .single();

  if (fetchErr || !original) {
    return NextResponse.json({ message: 'Action not found or not completed' }, { status: 404 });
  }

  if (!original.is_revertible) {
    return NextResponse.json({ message: 'Action is not revertible' }, { status: 400 });
  }

  // Update original to reverted
  await supabase
    .from('lc_agent_actions')
    .update({
      status: 'reverted',
      reverted_at: new Date().toISOString(),
      revert_reason: body.reason || 'Manual revert',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  // Create a revert action that references the original
  const { data: revertAction, error: insertErr } = await supabase
    .from('lc_agent_actions')
    .insert({
      property_id: original.property_id,
      agent_name: 'system_revert',
      action_type: `revert_${original.action_type}`,
      action_category: original.action_category,
      execution_channel: original.execution_channel,
      title: `Revert: ${original.title}`,
      description: `Reverting action due to: ${body.reason || 'Manual revert'}`,
      payload: original.payload,  // The executor will use the before-state snapshot to restore
      status: 'auto_approved',
      priority: 'high',
      requires_approval: false,
      is_revertible: false,
      revert_action_id: original.id,
      state_snapshot_id: original.state_snapshot_id,
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ message: insertErr.message }, { status: 500 });
  return NextResponse.json({ data: revertAction, reverted_action_id: id });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCancel(supabase: any, id: string) {
  const { data, error } = await supabase
    .from('lc_agent_actions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', ['proposed', 'approved', 'auto_approved'])
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: 'Action not found or already executed' }, { status: 404 });
  return NextResponse.json({ data });
}
