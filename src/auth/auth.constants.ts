export const SESSION_COOKIE_NAME = 'pergolando_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, sliding

/** Per-account lockout: after this many consecutive failures, lock out. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/** 6-digit codes (email verification, password reset). */
export const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_VERIFICATION_ATTEMPTS = 5;
/** Minimum gap between issuing a new code for the same purpose+seller. */
export const VERIFICATION_CODE_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute
