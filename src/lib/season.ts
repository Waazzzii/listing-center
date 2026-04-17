export type Season = 'peak' | 'shoulder' | 'low';

/**
 * Determine the current season for a given market and date.
 *
 * Season definitions by market:
 * - Arizona desert (scottsdale, tucson): Peak Oct-Apr, Shoulder May+Sep, Low Jun-Aug
 * - Sedona: Peak Mar-May + Sep-Nov, Shoulder Jun-Aug + Dec-Feb
 * - California coast (coachella): Peak Jan-Apr, Shoulder Oct-Dec, Low May-Sep
 * - Central Coast / OC / Lake Arrowhead: Peak Jun-Sep, Shoulder Mar-May + Oct, Low Nov-Feb
 */
export function getSeason(market: string, date: Date): Season {
  const month = date.getMonth(); // 0-indexed (0=Jan, 11=Dec)

  switch (market) {
    case 'scottsdale':
    case 'tucson':
      // Arizona desert: snowbird season
      if (month >= 9 || month <= 3) return 'peak';       // Oct-Apr
      if (month === 4 || month === 8) return 'shoulder';  // May, Sep
      return 'low';                                        // Jun-Aug

    case 'sedona':
      // Sedona: spring and fall
      if ((month >= 2 && month <= 4) || (month >= 8 && month <= 10)) return 'peak'; // Mar-May, Sep-Nov
      return 'shoulder'; // Everything else

    case 'coachella':
      // Coachella Valley: winter/spring
      if (month >= 0 && month <= 3) return 'peak';        // Jan-Apr
      if (month >= 9 && month <= 11) return 'shoulder';    // Oct-Dec
      return 'low';                                         // May-Sep

    case 'central_coast':
    case 'orange_county':
    case 'lake_arrowhead':
      // California summer markets
      if (month >= 5 && month <= 8) return 'peak';        // Jun-Sep
      if ((month >= 2 && month <= 4) || month === 9) return 'shoulder'; // Mar-May, Oct
      return 'low';                                         // Nov-Feb

    default:
      // Unknown market — default to shoulder (conservative)
      return 'shoulder';
  }
}
