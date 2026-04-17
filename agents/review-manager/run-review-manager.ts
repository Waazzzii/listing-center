import { SupabaseClient } from '@supabase/supabase-js';
import {
  findPendingRatings,
  categorizeByUrgency,
  buildRatingPayload,
  updateRatingStatus,
} from './guest-rating-submitter';
import { draftReviewResponses } from './review-response-drafter';

export interface ReviewManagerResult {
  ratings_submitted: number;
  ratings_failed: number;
  ratings_urgent_alert: number;
  responses_drafted: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Run the full Review Manager cycle.
 *
 * 6A: Submit pending 5-star guest ratings (autonomous)
 * 6B: Draft review responses for new reviews (routed to approval for negatives)
 */
export async function runReviewManager(supabase: SupabaseClient): Promise<ReviewManagerResult> {
  const result: ReviewManagerResult = {
    ratings_submitted: 0,
    ratings_failed: 0,
    ratings_urgent_alert: 0,
    responses_drafted: 0,
    errors: [],
  };

  // Log execution start
  const { data: execution } = await supabase
    .from('lc_agent_executions')
    .insert({
      agent_name: 'review_manager',
      execution_type: 'scheduled',
      status: 'running',
    })
    .select('id')
    .single();

  try {
    // ===== 6A: Guest Rating Submissions =====
    const pendingRatings = await findPendingRatings(supabase);
    const urgency = categorizeByUrgency(pendingRatings);

    result.ratings_urgent_alert = urgency.urgent.length + urgency.overdue.length;

    // Process all pending ratings (urgent first, then normal)
    const allToProcess = [...urgency.urgent, ...urgency.normal];

    for (const rating of allToProcess) {
      try {
        const payload = buildRatingPayload(rating.guest_name, rating.property_id);

        // In production, this would use Playwright with the account's session
        // For now, mark as submitted (Playwright integration comes from Plan 2 patterns)
        await updateRatingStatus(supabase, rating.id, 'submitted', payload.review_text);
        result.ratings_submitted++;
      } catch (err: unknown) {
        result.ratings_failed++;
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({ id: rating.id, error: message });
        await updateRatingStatus(supabase, rating.id, 'failed');
      }
    }

    // ===== 6B: Review Response Drafting =====
    const drafted = await draftReviewResponses(supabase);
    result.responses_drafted = drafted;

  } catch (fatalError: unknown) {
    const message = fatalError instanceof Error ? fatalError.message : String(fatalError);
    result.errors.push({ id: 'system', error: message });
  }

  // Update execution log
  if (execution) {
    await supabase
      .from('lc_agent_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        properties_processed: result.ratings_submitted + result.ratings_failed,
        results_summary: {
          ratings_submitted: result.ratings_submitted,
          ratings_failed: result.ratings_failed,
          responses_drafted: result.responses_drafted,
          urgent_alerts: result.ratings_urgent_alert,
        },
        errors: result.errors.length > 0 ? result.errors : null,
      })
      .eq('id', execution.id);
  }

  return result;
}
