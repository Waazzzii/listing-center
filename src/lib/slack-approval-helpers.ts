import { getSupabase } from '@/lib/supabase';

// ---- Action Parser ----

export interface ParsedAction {
  action: 'approve' | 'reject' | 'defer';
  recommendation_id: string;
  target_type: 'recommendation' | 'agent_action';
}

export function parseSlackAction(actionId: string): ParsedAction | null {
  // Match recommendation actions: approve_rec_<uuid>
  const recMatch = actionId.match(/^(approve|reject|defer)_rec_(.+)$/);
  if (recMatch) {
    return {
      action: recMatch[1] as ParsedAction['action'],
      recommendation_id: recMatch[2],
      target_type: 'recommendation',
    };
  }

  // Match agent action approvals: approve_action_<uuid>
  const actionMatch = actionId.match(/^(approve|reject|defer)_action_(.+)$/);
  if (actionMatch) {
    return {
      action: actionMatch[1] as ParsedAction['action'],
      recommendation_id: actionMatch[2],  // reusing field name for backwards compat
      target_type: 'agent_action',
    };
  }

  return null;
}

// ---- Action Processors ----

export async function processApproval(
  recommendationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('lc_recommendations')
    .update({
      status: 'approved',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendationId);

  if (error) return { success: false, error: error.message };

  // Also create a change_log entry for the approved recommendation
  const { data: rec } = await supabase
    .from('lc_recommendations')
    .select('*')
    .eq('id', recommendationId)
    .single();

  if (rec) {
    await supabase.from('lc_change_log').insert({
      property_id: rec.property_id,
      change_type: rec.recommendation_type,
      change_source: `agent_${rec.agent_name}`,
      thesis: rec.description,
      diagnosed_issue: rec.diagnosed_issue,
      predicted_impact: rec.predicted_impact,
      approval_status: 'approved',
      execution_status: 'pending',
    });
  }

  return { success: true };
}

export async function processRejection(
  recommendationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('lc_recommendations')
    .update({
      status: 'rejected',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: 'Rejected via Slack',
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendationId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function processDeferral(
  recommendationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  // Defer for 7 days
  const deferUntil = new Date();
  deferUntil.setDate(deferUntil.getDate() + 7);

  const { error } = await supabase
    .from('lc_recommendations')
    .update({
      status: 'deferred',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      defer_until: deferUntil.toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendationId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---- Agent Action Processors ----

export async function processActionApproval(
  actionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('lc_agent_actions')
    .update({
      status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)
    .eq('status', 'proposed');

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function processActionRejection(
  actionId: string,
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('lc_agent_actions')
    .update({
      status: 'cancelled',
      rejection_reason: reason || 'Rejected via Slack',
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)
    .in('status', ['proposed', 'approved']);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function processActionDeferral(
  actionId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  // Defer by setting expires_at to 7 days from now (action stays proposed)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error } = await supabase
    .from('lc_agent_actions')
    .update({
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)
    .eq('status', 'proposed');

  if (error) return { success: false, error: error.message };
  return { success: true };
}
