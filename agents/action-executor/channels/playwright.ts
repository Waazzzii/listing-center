// agents/action-executor/channels/playwright.ts
// Executes listing changes via Playwright browser automation on OTA portals.
// This is the channel for discounts, descriptions, amenities, photos, and
// any other listing attribute that can only be changed through the OTA UI.
//
// Architecture:
// - Each OTA (Airbnb, VRBO, Booking.com) has its own page-object module
// - Actions are dispatched to the appropriate OTA handler
// - Screenshots are captured before/after for audit trail
// - All browser sessions go through the shared session manager

import type { AgentAction } from '../../../src/lib/types';
import type { ExecutionResult } from '../executor';

// OTA-specific action handlers (to be implemented per OTA)
interface OTAHandler {
  setDiscount(params: DiscountParams): Promise<ExecutionResult>;
  setPromotion(params: PromotionParams): Promise<ExecutionResult>;
  updateDescription(params: DescriptionParams): Promise<ExecutionResult>;
  updateTitle(params: TitleParams): Promise<ExecutionResult>;
  toggleAmenity(params: AmenityParams): Promise<ExecutionResult>;
  reorderPhotos(params: PhotoParams): Promise<ExecutionResult>;
  updateCancellationPolicy(params: CancellationParams): Promise<ExecutionResult>;
  toggleInstantBook(params: InstantBookParams): Promise<ExecutionResult>;
  setMinNights(params: MinNightsParams): Promise<ExecutionResult>;
}

// Payload parameter types
interface DiscountParams {
  listing_id: string;
  discount_type: 'weekly' | 'monthly' | 'custom_promotion' | 'early_bird' | 'last_minute' | 'new_listing';
  percentage: number;
  start_date?: string;
  end_date?: string;
}

interface PromotionParams {
  listing_id: string;
  promotion_type: 'custom';
  percentage: number;  // 10, 15, or 20 for Airbnb
  start_date: string;
  end_date: string;
  min_nights?: number;
}

interface DescriptionParams {
  listing_id: string;
  section: 'summary' | 'space' | 'access' | 'neighborhood' | 'transit' | 'notes';
  new_text: string;
}

interface TitleParams {
  listing_id: string;
  new_title: string;
}

interface AmenityParams {
  listing_id: string;
  amenity_id: string;
  enabled: boolean;
}

interface PhotoParams {
  listing_id: string;
  photo_order: string[];  // photo IDs in new order
}

interface CancellationParams {
  listing_id: string;
  policy: 'flexible' | 'moderate' | 'firm' | 'strict' | 'super_strict';
}

interface InstantBookParams {
  listing_id: string;
  enabled: boolean;
}

interface MinNightsParams {
  listing_id: string;
  min_nights: number;
}

/**
 * Execute a Playwright-based OTA action.
 * Routes to the correct OTA and action type.
 */
export async function executePlaywrightAction(action: AgentAction): Promise<ExecutionResult> {
  const payload = action.payload;
  const listingId = payload.listing_id as string;

  if (!listingId) {
    return { success: false, error: 'Missing listing_id in payload' };
  }

  // Determine which OTA we're targeting
  const ota = action.execution_channel.replace('playwright_', '') as 'airbnb' | 'vrbo' | 'booking';

  try {
    switch (action.action_type) {
      case 'discount_set':
        return await dispatchDiscount(ota, {
          listing_id: listingId,
          discount_type: payload.discount_type as DiscountParams['discount_type'],
          percentage: payload.percentage as number,
          start_date: payload.start_date as string | undefined,
          end_date: payload.end_date as string | undefined,
        });

      case 'promotion_set':
        return await dispatchPromotion(ota, {
          listing_id: listingId,
          promotion_type: 'custom',
          percentage: payload.percentage as number,
          start_date: payload.start_date as string,
          end_date: payload.end_date as string,
          min_nights: payload.min_nights as number | undefined,
        });

      case 'description_update':
        return await dispatchDescription(ota, {
          listing_id: listingId,
          section: payload.section as DescriptionParams['section'],
          new_text: payload.new_text as string,
        });

      case 'title_update':
        return await dispatchTitle(ota, {
          listing_id: listingId,
          new_title: payload.new_title as string,
        });

      case 'amenity_toggle':
        return await dispatchAmenity(ota, {
          listing_id: listingId,
          amenity_id: payload.amenity_id as string,
          enabled: payload.enabled as boolean,
        });

      case 'photo_reorder':
        return await dispatchPhotoReorder(ota, {
          listing_id: listingId,
          photo_order: payload.photo_order as string[],
        });

      case 'cancellation_policy_change':
        return await dispatchCancellationPolicy(ota, {
          listing_id: listingId,
          policy: payload.policy as CancellationParams['policy'],
        });

      case 'instant_book_toggle':
        return await dispatchInstantBook(ota, {
          listing_id: listingId,
          enabled: payload.enabled as boolean,
        });

      case 'min_nights_change':
        return await dispatchMinNights(ota, {
          listing_id: listingId,
          min_nights: payload.min_nights as number,
        });

      default:
        return { success: false, error: `Unknown Playwright action type: ${action.action_type}` };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Playwright execution error',
    };
  }
}

// ─── Dispatch Functions ─────────────────────────────────────────────────────
// These will delegate to OTA-specific page objects once implemented.
// For now they return structured stubs that document the expected behavior.

async function dispatchDiscount(ota: string, params: DiscountParams): Promise<ExecutionResult> {
  // TODO: Implement via Playwright page objects per OTA
  // Airbnb: Navigate to listing > Pricing > Discounts > Set percentage
  // VRBO: Navigate to listing > Rates > Discounts
  // Booking.com: Navigate to property > Rates & Availability > Promotions

  console.log(`[Playwright:${ota}] Setting ${params.discount_type} discount to ${params.percentage}% on listing ${params.listing_id}`);

  return {
    success: false,
    error: `Playwright ${ota} discount execution not yet implemented. Payload captured for manual execution.`,
    result: {
      ota,
      action: 'discount_set',
      params,
      manual_steps: getManualSteps(ota, 'discount', params),
    },
  };
}

async function dispatchPromotion(ota: string, params: PromotionParams): Promise<ExecutionResult> {
  console.log(`[Playwright:${ota}] Setting custom promotion ${params.percentage}% for ${params.start_date} to ${params.end_date}`);

  return {
    success: false,
    error: `Playwright ${ota} promotion execution not yet implemented.`,
    result: { ota, action: 'promotion_set', params },
  };
}

async function dispatchDescription(ota: string, params: DescriptionParams): Promise<ExecutionResult> {
  console.log(`[Playwright:${ota}] Updating ${params.section} description on listing ${params.listing_id}`);

  return {
    success: false,
    error: `Playwright ${ota} description update not yet implemented.`,
    result: { ota, action: 'description_update', params },
  };
}

async function dispatchTitle(ota: string, params: TitleParams): Promise<ExecutionResult> {
  console.log(`[Playwright:${ota}] Updating title on listing ${params.listing_id}`);

  return {
    success: false,
    error: `Playwright ${ota} title update not yet implemented.`,
    result: { ota, action: 'title_update', params },
  };
}

async function dispatchAmenity(ota: string, params: AmenityParams): Promise<ExecutionResult> {
  console.log(`[Playwright:${ota}] Toggling amenity ${params.amenity_id} to ${params.enabled}`);

  return {
    success: false,
    error: `Playwright ${ota} amenity toggle not yet implemented.`,
    result: { ota, action: 'amenity_toggle', params },
  };
}

async function dispatchPhotoReorder(ota: string, params: PhotoParams): Promise<ExecutionResult> {
  console.log(`[Playwright:${ota}] Reordering photos on listing ${params.listing_id}`);

  return {
    success: false,
    error: `Playwright ${ota} photo reorder not yet implemented.`,
    result: { ota, action: 'photo_reorder', params },
  };
}

async function dispatchCancellationPolicy(ota: string, params: CancellationParams): Promise<ExecutionResult> {
  console.log(`[Playwright:${ota}] Changing cancellation policy to ${params.policy}`);

  return {
    success: false,
    error: `Playwright ${ota} cancellation policy change not yet implemented.`,
    result: { ota, action: 'cancellation_policy_change', params },
  };
}

async function dispatchInstantBook(ota: string, params: InstantBookParams): Promise<ExecutionResult> {
  console.log(`[Playwright:${ota}] Toggling Instant Book to ${params.enabled}`);

  return {
    success: false,
    error: `Playwright ${ota} instant book toggle not yet implemented.`,
    result: { ota, action: 'instant_book_toggle', params },
  };
}

async function dispatchMinNights(ota: string, params: MinNightsParams): Promise<ExecutionResult> {
  console.log(`[Playwright:${ota}] Setting min nights to ${params.min_nights}`);

  return {
    success: false,
    error: `Playwright ${ota} min nights change not yet implemented.`,
    result: { ota, action: 'min_nights_change', params },
  };
}

/**
 * Generate manual execution steps for when Playwright isn't yet implemented.
 * These get included in the Slack notification so a human can do it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getManualSteps(ota: string, actionType: string, params: any): string[] {
  if (ota === 'airbnb' && actionType === 'discount') {
    return [
      `1. Go to Airbnb Host Dashboard > Listing ${params.listing_id}`,
      `2. Click "Pricing" tab`,
      `3. Scroll to "${params.discount_type}" section`,
      `4. Set to ${params.percentage}%`,
      `5. Save changes`,
    ];
  }
  return [`Execute ${actionType} on ${ota} listing ${params.listing_id}`];
}
