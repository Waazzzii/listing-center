import type { FunnelDiagnosis, FunnelIssue, FunnelOpportunity, FunnelStage } from './analyzer';

export interface RecommendationDraft {
  property_id: string;
  agent_name: 'funnel_analysis';
  recommendation_type: string;
  title: string;
  description: string;
  predicted_impact: string;
  diagnosed_issue: string;
  funnel_stage: FunnelStage;
  severity: string;
  proposed_change: Record<string, any> | null;
  status: 'pending';
}

interface PropertyContext {
  property_id: string;
  property_name: string;
  market: string;
  quality_tier: string;
}

// ---- Issue-to-Recommendation Mapping ----

interface RecommendationTemplate {
  recommendation_type: string;
  title: string;
  description: string;
  predicted_impact: string;
}

const TOP_FUNNEL_RECOMMENDATIONS: RecommendationTemplate[] = [
  {
    recommendation_type: 'price_decrease',
    title: 'Review pricing — algorithm is suppressing search impressions',
    description: 'First page impression rate is below the benchmark for this quality tier. The Airbnb algorithm scores listings on a True Negative framework where price-to-value ratio is a major factor. Consider a 5-10% rate reduction during shoulder season, or review WheelHouse comp set to confirm positioning.',
    predicted_impact: 'Expected +10-20% impression rate within 2-3 weeks of adjustment',
  },
  {
    recommendation_type: 'cancellation_change',
    title: 'Switch to flexible cancellation policy to boost algorithm ranking',
    description: 'Cancellation policy acts as an exponent on the Airbnb True Negative Score. Flexible policies get an algorithm boost vs strict/firm. Consider switching to Flexible or Moderate during low-demand periods. This is often the single biggest lever for impression rate.',
    predicted_impact: 'Expected +5-15% impression rate; cancellation policy is a multiplier on ranking',
  },
];

const MID_FUNNEL_RECOMMENDATIONS: RecommendationTemplate[] = [
  {
    recommendation_type: 'hero_photo_swap',
    title: 'Audit and swap hero photo — CTR is below benchmark',
    description: 'The hero photo is the single biggest lever for click-through rate. Sean proved hero photo swaps can deliver 300% CTR lifts. Check: Does the current hero establish the space? Does it crop well to the search thumbnail size? Is it bright, inviting, and high-resolution? Recommend testing an aerial/wide shot of the most compelling feature (pool, view, outdoor living).',
    predicted_impact: 'Expected +30-200% CTR improvement based on historical hero photo A/B tests',
  },
  {
    recommendation_type: 'title_rewrite',
    title: 'Rewrite listing title — not compelling enough to drive clicks',
    description: 'The listing title appears in search results alongside the hero photo. It should lead with the most compelling feature, include key differentiators, and create urgency or aspiration. Avoid generic descriptions.',
    predicted_impact: 'Expected +5-15% CTR improvement',
  },
];

const BOTTOM_FUNNEL_RECOMMENDATIONS: RecommendationTemplate[] = [
  {
    recommendation_type: 'description_update',
    title: 'Update listing description — "1 out of 100" audit needed',
    description: 'Booking conversion is below benchmark. Per Sean\'s framework, each missing detail costs 1/100 potential bookers. Audit the description for: coffee/beverage station details, sleep quality (blackout curtains, mattress quality), kitchen details, family amenities, pet policy, parking specifics, pool/spa details, workspace setup, checkout time, location context, accessibility info. Three missing elements can drop conversion from 3.5% to 0.5%.',
    predicted_impact: 'Expected +0.5-2.0% absolute conversion lift from comprehensive description update',
  },
  {
    recommendation_type: 'amenity_add',
    title: 'Photo and amenity gap analysis — missing conversion-critical details',
    description: 'Cross-reference the property amenity list against the conversion-critical checklist. Missing photos of coffee stations, blackout curtains, workspaces, pool areas, and pet amenities each cost potential bookings. Each amenity photo added is a small conversion lift.',
    predicted_impact: 'Expected +0.3-1.0% absolute conversion lift per critical amenity photo added',
  },
];

const VALUE_CAPTURE_RECOMMENDATIONS: Record<FunnelStage, RecommendationTemplate> = {
  top: {
    recommendation_type: 'price_increase',
    title: 'Over-represented in search — raise rates to capture value',
    description: 'Impression rate is above the high benchmark, meaning the algorithm is heavily favoring this listing. This is a pricing opportunity: the listing is likely under-priced for its value index. Recommend raising rates 10-15% or tightening cancellation policy strategically.',
    predicted_impact: 'Expected +10-15% ADR increase with minimal occupancy impact',
  },
  mid: {
    recommendation_type: 'price_increase',
    title: 'Strong mid-funnel — consider rate adjustment',
    description: 'CTR is performing well above benchmark. The listing is attracting clicks efficiently.',
    predicted_impact: 'Monitor — mid-funnel value capture is unusual',
  },
  bottom: {
    recommendation_type: 'price_increase',
    title: 'Converting at premium rate — listing is under-priced',
    description: 'Booking conversion exceeds the high benchmark, indicating demand exceeds current pricing. Guests are booking quickly because they perceive outsized value. Recommend raising rates 10-15% — conversion should absorb a moderate price increase.',
    predicted_impact: 'Expected +10-15% ADR increase; conversion may drop slightly but net revenue increases',
  },
};

// ---- Main Function ----

export function generateRecommendations(
  diagnosis: FunnelDiagnosis,
  context: PropertyContext
): RecommendationDraft[] {
  if (diagnosis.skipped) return [];
  if (diagnosis.issues.length === 0 && diagnosis.opportunities.length === 0) return [];

  const recommendations: RecommendationDraft[] = [];

  // Generate recommendations from issues
  for (const issue of diagnosis.issues) {
    const templates = getTemplatesForIssue(issue);
    for (const template of templates) {
      recommendations.push({
        property_id: context.property_id,
        agent_name: 'funnel_analysis',
        recommendation_type: template.recommendation_type,
        title: template.title,
        description: `[${context.property_name} — ${context.market} — ${context.quality_tier}]\n\n${template.description}\n\nDiagnosed issue: ${issue.diagnosis}\nLikely causes: ${issue.likely_causes.join(', ')}`,
        predicted_impact: template.predicted_impact,
        diagnosed_issue: issue.diagnosis,
        funnel_stage: issue.stage,
        severity: issue.severity,
        proposed_change: null,
        status: 'pending',
      });
    }
  }

  // Generate recommendations from opportunities
  for (const opportunity of diagnosis.opportunities) {
    const template = VALUE_CAPTURE_RECOMMENDATIONS[opportunity.stage];
    if (template) {
      recommendations.push({
        property_id: context.property_id,
        agent_name: 'funnel_analysis',
        recommendation_type: template.recommendation_type,
        title: template.title,
        description: `[${context.property_name} — ${context.market} — ${context.quality_tier}]\n\n${template.description}\n\nOpportunity: ${opportunity.diagnosis}`,
        predicted_impact: template.predicted_impact,
        diagnosed_issue: opportunity.diagnosis,
        funnel_stage: opportunity.stage,
        severity: 'opportunity',
        proposed_change: null,
        status: 'pending',
      });
    }
  }

  return recommendations;
}

function getTemplatesForIssue(issue: FunnelIssue): RecommendationTemplate[] {
  switch (issue.stage) {
    case 'top':
      return TOP_FUNNEL_RECOMMENDATIONS;
    case 'mid':
      return MID_FUNNEL_RECOMMENDATIONS;
    case 'bottom':
      return BOTTOM_FUNNEL_RECOMMENDATIONS;
    default:
      return [];
  }
}
