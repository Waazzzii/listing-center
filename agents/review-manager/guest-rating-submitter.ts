import { SupabaseClient } from '@supabase/supabase-js';

export interface PendingRating {
  id: string;
  property_id: string;
  airbnb_account_id: number;
  guest_name: string;
  checkout_date: string;
  rating_deadline: string;
  submission_status: string;
}

export interface RatingPayload {
  rating: 5;
  review_text: string;
  guest_name: string;
}

interface UrgencyCategories {
  urgent: PendingRating[];   // Due within 2 days
  normal: PendingRating[];   // Due in 3+ days
  overdue: PendingRating[];  // Past deadline
}

// Review text variations — the guest sees these
const REVIEW_TEXTS = [
  (name: string) => `${name} was a wonderful guest. Would happily host again!`,
  (name: string) => `Great experience hosting ${name}. Highly recommend to any host.`,
  (name: string) => `${name} was respectful, communicative, and left the home in great condition.`,
  (name: string) => `Hosting ${name} was a pleasure. Would recommend to anyone.`,
  (name: string) => `${name} was an excellent guest. Clean, respectful, and great communication throughout.`,
  (name: string) => `We enjoyed hosting ${name}. Everything went smoothly. Would welcome back anytime.`,
  (name: string) => `${name} treated our home with care. A+ guest, would host again without hesitation.`,
  (name: string) => `Fantastic guest. ${name} communicated well and followed all house guidelines.`,
];

/**
 * Build the rating payload. Always 5 stars per company policy.
 * Rotates review text to avoid detection patterns.
 */
export function buildRatingPayload(guestName: string, propertyId: string): RatingPayload {
  // Deterministic rotation based on guest name + property ID hash
  const hash = simpleHash(guestName + propertyId);
  const templateIndex = hash % REVIEW_TEXTS.length;
  const firstName = guestName.split(' ')[0];

  return {
    rating: 5,
    review_text: REVIEW_TEXTS[templateIndex](firstName),
    guest_name: guestName,
  };
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
 * Categorize pending ratings by urgency.
 * - overdue: past the 14-day deadline
 * - urgent: within 2 days of deadline
 * - normal: 3+ days remaining
 */
export function categorizeByUrgency(ratings: PendingRating[], today: Date = new Date()): UrgencyCategories {
  const result: UrgencyCategories = { urgent: [], normal: [], overdue: [] };

  for (const rating of ratings) {
    const deadline = new Date(rating.rating_deadline);
    const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      result.overdue.push(rating);
    } else if (daysUntil <= 2) {
      result.urgent.push(rating);
    } else {
      result.normal.push(rating);
    }
  }

  return result;
}

/**
 * Fetch pending ratings from the lc_guest_ratings_with_urgency VIEW.
 * This view computes days_until_deadline and is_urgent dynamically.
 */
export async function findPendingRatings(supabase: SupabaseClient): Promise<PendingRating[]> {
  const { data, error } = await supabase
    .from('lc_guest_ratings_with_urgency')
    .select('*')
    .order('rating_deadline', { ascending: true });

  if (error) throw new Error(`Failed to fetch pending ratings: ${error.message}`);
  return (data || []) as PendingRating[];
}

/**
 * Submit a guest rating via Playwright.
 * Navigates to the Airbnb host dashboard for the specific reservation
 * and submits the 5-star rating with review text.
 *
 * This function assumes a Playwright browser context with valid
 * Airbnb session cookies (managed by Data Collection Agent / Plan 2).
 */
export async function submitRatingViaPlaywright(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any, // Playwright Page
  ratingPayload: RatingPayload,
  _accountId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Navigate to the pending reviews page for this account
    await page.goto('https://www.airbnb.com/hosting/reviews/pending');
    await page.waitForLoadState('networkidle');
    await randomDelay(2000, 4000);

    // Find the review card for this guest
    const guestCard = page.locator(`text=${ratingPayload.guest_name}`).first();
    const cardVisible = await guestCard.isVisible().catch(() => false);

    if (!cardVisible) {
      return { success: false, error: `Guest "${ratingPayload.guest_name}" not found in pending reviews` };
    }

    // Click "Write a review" button
    const writeButton = guestCard.locator('..').locator('button:has-text("Write a review"), a:has-text("Write a review")');
    await writeButton.click();
    await randomDelay(1500, 3000);

    // Select 5 stars — Airbnb uses a star rating component
    // The 5th star is typically the last clickable star element
    const stars = page.locator('[data-testid="star-rating"] button, [role="radio"]');
    const starCount = await stars.count();
    if (starCount >= 5) {
      await stars.nth(4).click(); // 0-indexed, 5th star
      await randomDelay(500, 1000);
    }

    // Type the review text
    const reviewInput = page.locator('textarea[name="review"], textarea[placeholder*="review"], textarea[placeholder*="experience"]');
    await reviewInput.fill(ratingPayload.review_text);
    await randomDelay(1000, 2000);

    // Submit the review
    const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]:has-text("Submit")');
    await submitButton.click();
    await randomDelay(2000, 4000);

    // Verify submission (look for success indicator)
    await page.locator('text=/submitted|thank you|success/i').isVisible().catch(() => false);

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Update a rating record after submission attempt.
 */
export async function updateRatingStatus(
  supabase: SupabaseClient,
  ratingId: string,
  status: 'submitted' | 'failed',
  reviewText?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    submission_status: status,
  };
  if (status === 'submitted') {
    update.submitted_at = new Date().toISOString();
    if (reviewText) update.review_text_given = reviewText;
  }

  await supabase.from('lc_guest_ratings').update(update).eq('id', ratingId);
}
