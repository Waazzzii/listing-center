import { SupabaseClient } from '@supabase/supabase-js';
import templates from './response-templates.json';

type Sentiment = 'positive' | 'neutral' | 'negative';

/**
 * Classify review sentiment based on star rating.
 */
export function classifyReviewSentiment(rating: number | null): Sentiment {
  if (rating == null) return 'neutral';
  if (rating >= 4) return 'positive';
  if (rating >= 3) return 'neutral';
  return 'negative';
}

/**
 * Determine if a review response can be auto-posted.
 * Only positive reviews (4-5 stars) are auto-posted.
 * Negative and neutral reviews always go through approval.
 */
export function shouldAutoPost(sentiment: Sentiment): boolean {
  return sentiment === 'positive';
}

/**
 * Select a template from the rotation based on sentiment and a deterministic hash.
 * Uses the review ID to ensure consistent template selection per review
 * while rotating across the full template set.
 */
export function selectTemplate(sentiment: Sentiment, reviewId: string): string {
  const templateSet = sentiment === 'negative'
    ? templates.negative
    : sentiment === 'neutral'
    ? templates.neutral
    : templates.positive;

  const hash = simpleHash(reviewId);
  const index = hash % templateSet.length;
  return templateSet[index];
}

/**
 * Interpolate template variables with actual values.
 */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  // Clean up any remaining unreplaced placeholders
  result = result.replace(/\{[^}]+\}/g, '');
  return result;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Draft review responses for all unresponded reviews.
 * Returns the count of responses drafted.
 */
export async function draftReviewResponses(supabase: SupabaseClient): Promise<number> {
  // Fetch reviews that need responses
  const { data: reviews, error } = await supabase
    .from('lc_reviews')
    .select('*, lc_properties!inner(property_name)')
    .eq('response_status', 'pending')
    .order('review_date', { ascending: true })
    .limit(50);

  if (error) throw new Error(`Failed to fetch pending reviews: ${error.message}`);
  if (!reviews || reviews.length === 0) return 0;

  let draftedCount = 0;

  for (const review of reviews) {
    const sentiment = classifyReviewSentiment(review.rating);
    const template = selectTemplate(sentiment, review.id);
    const propertyName = review.lc_properties?.property_name || 'our property';
    const guestFirstName = (review.guest_name || 'Guest').split(' ')[0];

    const responseText = interpolateTemplate(template, {
      guest_name: guestFirstName,
      property_name: propertyName,
    });

    const autoPost = shouldAutoPost(sentiment);

    await supabase
      .from('lc_reviews')
      .update({
        response_text: responseText,
        response_status: autoPost ? 'approved' : 'drafted',
        response_drafted_at: new Date().toISOString(),
        sentiment,
      })
      .eq('id', review.id);

    draftedCount++;
  }

  return draftedCount;
}
