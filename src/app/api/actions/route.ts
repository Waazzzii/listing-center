export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

const LIST_COLUMNS = [
  'id', 'property_id', 'agent_name', 'action_type', 'action_category',
  'execution_channel', 'title', 'description', 'expected_impact',
  'confidence_score', 'status', 'priority', 'requires_approval',
  'approved_by', 'approved_at', 'executed_at', 'is_revertible',
  'auto_revert_if_regression', 'measurement_due_at', 'batch_id',
  'created_at', 'updated_at',
].join(',');

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);

  let query = supabase.from('lc_action_queue').select(LIST_COLUMNS);

  // Filters
  const status = searchParams.get('status');
  if (status) query = query.eq('status', status);

  const category = searchParams.get('category');
  if (category) query = query.eq('action_category', category);

  const agent = searchParams.get('agent');
  if (agent) query = query.eq('agent_name', agent);

  const propertyId = searchParams.get('property_id');
  if (propertyId) query = query.eq('property_id', propertyId);

  const priority = searchParams.get('priority');
  if (priority) query = query.eq('priority', priority);

  const batchId = searchParams.get('batch_id');
  if (batchId) query = query.eq('batch_id', batchId);

  const limit = parseInt(searchParams.get('limit') || '100', 10);
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const body = await req.json();

  // Validate required fields
  const required = ['property_id', 'agent_name', 'action_type', 'action_category', 'execution_channel', 'title'];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ message: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  // Auto-approve if confidence is high enough and approval not required
  const confidenceThreshold = 80;
  const autoApprove = !body.requires_approval && body.confidence_score >= confidenceThreshold;

  const action = {
    property_id: body.property_id,
    agent_name: body.agent_name,
    agent_run_id: body.agent_run_id || null,
    action_type: body.action_type,
    action_category: body.action_category,
    execution_channel: body.execution_channel,
    title: body.title,
    description: body.description || null,
    payload: body.payload || {},
    expected_impact: body.expected_impact || null,
    confidence_score: body.confidence_score || null,
    status: autoApprove ? 'auto_approved' : 'proposed',
    priority: body.priority || 'normal',
    requires_approval: body.requires_approval ?? true,
    is_revertible: body.is_revertible ?? true,
    auto_revert_if_regression: body.auto_revert_if_regression ?? false,
    recommendation_id: body.recommendation_id || null,
    parent_action_id: body.parent_action_id || null,
    batch_id: body.batch_id || null,
    expires_at: body.expires_at || null,
  };

  const { data, error } = await supabase
    .from('lc_agent_actions')
    .insert(action)
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
