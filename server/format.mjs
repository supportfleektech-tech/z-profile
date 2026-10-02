/**
 * Server-side formatting utilities.
 */

const UID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a unique ID with a prefix.
 * @param {string} prefix - The prefix for the ID.
 * @returns {string} - A unique ID string.
 */
export function uid(prefix = '') {
  let result = prefix ? `${prefix}-` : '';
  for (let i = 0; i < 12; i++) {
    result += UID_CHARS[Math.floor(Math.random() * UID_CHARS.length)];
  }
  return result;
}

/**
 * Format a number as Kenyan Shillings.
 * @param {number} amount - The amount in KES (can be cents or whole shillings).
 * @param {Object} [opts] - Options.
 * @param {boolean} [opts.decimals=true] - Whether to show decimals.
 * @returns {string} - Formatted string like "KES 1,234" or "KES 1,234.56".
 */
export function KES(amount, { decimals = true } = {}) {
  const val = typeof amount === 'number' ? amount : 0;
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(val);
}