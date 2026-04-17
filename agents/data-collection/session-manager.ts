import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Page } from 'playwright';
import { getSupabase } from '@/lib/supabase';

// ============================================================
// ENCRYPTION
// ============================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Get the encryption key from environment.
 * Must be a 32-byte hex string (64 hex characters).
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.AIRBNB_SESSION_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'AIRBNB_SESSION_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: openssl rand -hex 32'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt session cookie data before storing in DB.
 * Returns a JSON string containing the IV, auth tag, and ciphertext (all base64).
 */
export function encryptSession(cookies: unknown[]): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(cookies);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    data: encrypted,
  });
}

/**
 * Decrypt session cookie data from DB storage.
 * Returns the array of Playwright cookie objects.
 */
export function decryptSession(encrypted: string): unknown[] {
  const key = getEncryptionKey();
  const { iv, authTag, data } = JSON.parse(encrypted);

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  let decrypted = decipher.update(data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

// ============================================================
// SESSION LIFECYCLE
// ============================================================

/**
 * Restore session cookies for an Airbnb account from encrypted DB storage.
 * Returns an array of Playwright-compatible cookie objects.
 *
 * If no session exists (new account), returns an empty array.
 * The scraper will detect the login redirect and alert for manual setup.
 */
export async function restoreSession(accountId: number): Promise<unknown[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('lc_airbnb_accounts')
    .select('session_data')
    .eq('id', accountId)
    .single();

  if (error || !data?.session_data) {
    console.warn(`[SessionManager] No session data for account ${accountId} — fresh login needed`);
    return [];
  }

  try {
    // session_data is stored as encrypted JSONB string
    const encryptedStr = typeof data.session_data === 'string'
      ? data.session_data
      : JSON.stringify(data.session_data);

    return decryptSession(encryptedStr);
  } catch (err) {
    console.error(`[SessionManager] Failed to decrypt session for account ${accountId}:`, err);
    return [];
  }
}

/**
 * Persist updated session cookies back to the DB.
 * Called after every scrape (even failed ones) so cookie updates propagate.
 *
 * This is critical for session longevity — Airbnb rotates cookies on each visit
 * and failing to save the updated cookies will cause the session to expire faster.
 */
export async function persistSession(
  accountId: number,
  cookies: unknown[],
): Promise<void> {
  const supabase = getSupabase();

  const encrypted = encryptSession(cookies);

  const { error } = await supabase
    .from('lc_airbnb_accounts')
    .update({
      session_data: encrypted,
      last_successful_login: new Date().toISOString(),
    })
    .eq('id', accountId);

  if (error) {
    console.error(`[SessionManager] Failed to persist session for account ${accountId}:`, error.message);
    throw error;
  }
}

/**
 * Detect whether the current page indicates a session expiry.
 *
 * Checks for:
 * 1. Redirect to login page
 * 2. Login form visible on page
 * 3. MFA challenge present
 */
export async function detectSessionExpired(page: Page): Promise<boolean> {
  const url = page.url();

  // Direct login redirect
  if (url.includes('/login') || url.includes('/authenticate') || url.includes('/account/login')) {
    return true;
  }

  // Check for login form elements on the page
  const hasLoginForm = await page.evaluate(() => {
    const emailInput = document.querySelector('input[name="email"], input[type="email"], #email-login-email');
    const passwordInput = document.querySelector('input[name="password"], input[type="password"]');
    const loginButton = document.querySelector('button[data-testid="login-button"], button[type="submit"]');
    return !!(emailInput || passwordInput || loginButton);
  });

  return hasLoginForm;
}

/**
 * Check if a session's cookies are likely still valid.
 * Airbnb sessions typically last 30 days with regular use.
 *
 * This is a heuristic check — the definitive test is attempting to load a page.
 */
export async function isSessionLikelyValid(accountId: number): Promise<boolean> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('lc_airbnb_accounts')
    .select('last_successful_login, session_data')
    .eq('id', accountId)
    .single();

  if (error || !data) return false;
  if (!data.session_data) return false;

  // If last successful login was more than 25 days ago, consider it at risk
  if (data.last_successful_login) {
    const lastLogin = new Date(data.last_successful_login);
    const daysSinceLogin = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLogin > 25) return false;
  }

  return true;
}
