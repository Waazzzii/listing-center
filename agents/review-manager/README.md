# Review Manager Agent

**Type:** Actor + Monitor
**Authority:** Execute (submit guest ratings, draft review responses)
**Cadence:** Daily (7:00 AM local time)

## Purpose

Manages two review workflows:
- **6A — Guest Rating Submitter:** Automatically submits 5-star host-to-guest ratings via Playwright before the 14-day Airbnb deadline. Always 5 stars per company policy (this is host rating OF guest).
- **6B — Review Response Drafter:** Drafts responses to guest reviews using a 25+ template rotation. Positive reviews (4-5 stars) auto-post. Negative reviews (1-3 stars) route to approval queue.

## Input

- `lc_guest_ratings_with_urgency` VIEW — pending ratings with dynamic deadline calculations
- `lc_reviews` — guest reviews needing responses
- `lc_properties` — property names for template interpolation
- `lc_airbnb_accounts` — session cookies for Playwright automation

## Output

- `lc_guest_ratings` updates (submission_status, submitted_at, review_text_given)
- `lc_reviews` updates (response_text, response_status, sentiment)
- `lc_agent_executions` row (operational tracking)
- Slack alerts for urgent/overdue ratings (< 24 hours to deadline)

## Process

### 6A: Guest Rating Submission
1. Query `lc_guest_ratings_with_urgency` for all pending ratings
2. Categorize by urgency: overdue / urgent (<=2 days) / normal
3. Alert via Slack if any ratings are within 24 hours of deadline
4. For each pending rating (urgent first):
   a. Build 5-star rating payload with rotated review text
   b. Navigate to Airbnb pending reviews page via Playwright
   c. Submit rating with random human-like delays
   d. Update `lc_guest_ratings` with submission result

### 6B: Review Response Drafting
1. Query `lc_reviews` where response_status = 'pending'
2. For each review:
   a. Classify sentiment from star rating (positive/neutral/negative)
   b. Select template from rotation (deterministic per review ID)
   c. Interpolate {guest_name} and {property_name}
   d. If positive: set response_status = 'approved' (auto-post)
   e. If negative/neutral: set response_status = 'drafted' (needs approval)

## Files

- `guest-rating-submitter.ts` — Rating payload builder, urgency categorization, Playwright submission
- `review-response-drafter.ts` — Sentiment classification, template selection, response drafting
- `response-templates.json` — 25+ positive, 7 negative, 6 neutral response templates
- `run-review-manager.ts` — Orchestrator entry point

## Company Policy

- **Always 5 stars** for guest ratings (host rating of guest)
- **Positive reviews auto-post**, negative/neutral require human approval
- Template rotation prevents repetitive-looking responses
- Urgent alerts for ratings within 24 hours of the 14-day deadline
