// agents/action-executor/channels/wheelhouse.ts
// Executes pricing and rate actions via the Wheelhouse API.
// Supports: base price changes, custom rate overrides, preference updates.

import {
  updatePreferences,
  setCustomRate,
  bulkSetCustomRates,
  getPreferences,
  type WhPreferences,
} from '../../../src/lib/wheelhouse';
import type { AgentAction } from '../../../src/lib/types';
import type { ExecutionResult } from '../executor';

// Default channel for Wheelhouse API calls
const DEFAULT_CHANNEL = 'airbnb';

/**
 * Route a Wheelhouse API action to the correct endpoint.
 *
 * Expected payload shapes by action_type:
 *
 * rate_change (base price):
 *   { listing_id: "123", channel: "airbnb", base_price: 250 }
 *
 * custom_rate_set (date-specific override):
 *   { listing_id: "123", channel: "airbnb", date: "2026-04-15", min_price: 200, max_price: 300 }
 *
 * bulk_rate_set:
 *   { listing_id: "123", channel: "airbnb", rates: [{ date: "...", min_price: 200 }, ...] }
 *
 * preference_update:
 *   { listing_id: "123", channel: "airbnb", preferences: { min_price: 150, ... } }
 */
export async function executeWheelhouseAction(action: AgentAction): Promise<ExecutionResult> {
  const payload = action.payload;
  const listingId = payload.listing_id as string;
  const channel = (payload.channel as string) || DEFAULT_CHANNEL;

  if (!listingId) {
    return { success: false, error: 'Missing listing_id in payload' };
  }

  try {
    switch (action.action_type) {
      case 'rate_change':
        return await executeRateChange(listingId, channel, payload);

      case 'custom_rate_set':
        return await executeCustomRate(listingId, channel, payload);

      case 'bulk_rate_set':
        return await executeBulkRates(listingId, channel, payload);

      case 'preference_update':
        return await executePreferenceUpdate(listingId, channel, payload);

      default:
        return { success: false, error: `Unknown Wheelhouse action type: ${action.action_type}` };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Wheelhouse API error',
    };
  }
}

async function executeRateChange(
  listingId: string,
  channel: string,
  payload: Record<string, unknown>
): Promise<ExecutionResult> {
  const newBasePrice = payload.base_price as number;
  if (!newBasePrice || newBasePrice <= 0) {
    return { success: false, error: 'Invalid base_price in payload' };
  }

  // Get current preferences first for audit trail
  const currentPrefs = await getPreferences(listingId, channel);

  // Update base price via preferences endpoint
  const update: Partial<WhPreferences> = {
    base_price: newBasePrice,
  };

  // base_price_adjustment can shift the base up/down
  if (payload.base_price_adjustment) update.base_price_adjustment = payload.base_price_adjustment as number;

  await updatePreferences(listingId, channel, update);

  return {
    success: true,
    result: {
      previous_base_price: currentPrefs?.base_price,
      new_base_price: newBasePrice,
      listing_id: listingId,
    },
  };
}

async function executeCustomRate(
  listingId: string,
  channel: string,
  payload: Record<string, unknown>
): Promise<ExecutionResult> {
  const date = payload.date as string;
  if (!date) {
    return { success: false, error: 'Missing date in payload' };
  }

  const rate: Record<string, unknown> = {};
  if (payload.min_price !== undefined) rate.min_price = payload.min_price;
  if (payload.max_price !== undefined) rate.max_price = payload.max_price;

  await setCustomRate(listingId, channel, date, rate);

  return {
    success: true,
    result: {
      listing_id: listingId,
      date,
      ...rate,
    },
  };
}

async function executeBulkRates(
  listingId: string,
  channel: string,
  payload: Record<string, unknown>
): Promise<ExecutionResult> {
  const rates = payload.rates as Record<string, unknown>[];
  if (!rates?.length) {
    return { success: false, error: 'Missing or empty rates array in payload' };
  }

  await bulkSetCustomRates(listingId, channel, rates);

  return {
    success: true,
    result: {
      listing_id: listingId,
      dates_updated: rates.length,
    },
  };
}

async function executePreferenceUpdate(
  listingId: string,
  channel: string,
  payload: Record<string, unknown>
): Promise<ExecutionResult> {
  const preferences = payload.preferences as Partial<WhPreferences>;
  if (!preferences || Object.keys(preferences).length === 0) {
    return { success: false, error: 'Missing or empty preferences in payload' };
  }

  const currentPrefs = await getPreferences(listingId, channel);
  await updatePreferences(listingId, channel, preferences);

  return {
    success: true,
    result: {
      listing_id: listingId,
      fields_updated: Object.keys(preferences),
      previous_values: currentPrefs,
    },
  };
}
