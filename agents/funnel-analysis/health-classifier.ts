import type { FunnelDiagnosis } from './analyzer';

const BLUE_SPELL_OCCUPANCY_THRESHOLD = 90;

export interface MarketContext {
  market_occupancy: number | null;
  previous_health_status?: string | null;
}

export interface HealthClassification {
  health_status: 'red' | 'orange' | 'yellow' | 'green' | 'blue_spell' | 'unknown';
  underlying_status: string; // The status before blue_spell override
  is_blue_spell: boolean;
  previous_health_status: string | null;
  status_changed: boolean;
}

export function classifyHealth(
  diagnosis: FunnelDiagnosis,
  context: MarketContext
): HealthClassification {
  // Skipped properties get unknown
  if (diagnosis.skipped) {
    return {
      health_status: 'unknown',
      underlying_status: 'unknown',
      is_blue_spell: false,
      previous_health_status: context.previous_health_status ?? null,
      status_changed: context.previous_health_status != null && context.previous_health_status !== 'unknown',
    };
  }

  // Determine base health status from issues and opportunities
  let baseStatus: 'red' | 'orange' | 'yellow' | 'green' = 'green';

  if (diagnosis.issues.some(i => i.severity === 'critical')) {
    baseStatus = 'red';
  } else if (diagnosis.issues.some(i => i.severity === 'high')) {
    baseStatus = 'orange';
  } else if (diagnosis.opportunities.some(o => o.type === 'value_capture')) {
    baseStatus = 'yellow';
  }

  // Check for Blue Spell condition
  const isBlueSpell =
    context.market_occupancy != null &&
    context.market_occupancy > BLUE_SPELL_OCCUPANCY_THRESHOLD;

  // Apply Blue Spell override logic:
  // - Red stays red (listing is fundamentally broken, even hot market won't save it)
  // - Orange/Yellow/Green get upgraded to blue_spell (market demand compensates)
  let finalStatus: 'red' | 'orange' | 'yellow' | 'green' | 'blue_spell' | 'unknown' = baseStatus;
  if (isBlueSpell && baseStatus !== 'red') {
    finalStatus = 'blue_spell';
  }

  const previousStatus = context.previous_health_status ?? null;
  const statusChanged = previousStatus != null && previousStatus !== finalStatus;

  return {
    health_status: finalStatus,
    underlying_status: baseStatus,
    is_blue_spell: isBlueSpell,
    previous_health_status: previousStatus,
    status_changed: statusChanged,
  };
}
