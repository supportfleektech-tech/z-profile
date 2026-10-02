/**
 * Server-side type definitions and constants (JSDoc for type hints).
 * Minimal subset needed by server modules to avoid importing from src/.
 */

export const SUB_USER_FREE_LIMIT = 5;
export const SUB_USER_PRICE_KES = 500;

// Permission strings (subset needed by server)
export const Permission = Object.freeze({
  // Sub-user permissions
  'users.create.sub': 'users.create.sub',
  'users.manage.sub': 'users.manage.sub',
});

// Permission strings for easy access
export const Permissions = Object.freeze({
  USERS_CREATE_SUB: 'users.create.sub',
  USERS_MANAGE_SUB: 'users.manage.sub',
});

/**
 * @typedef {Object} SubUserBillingResult
 * @property {boolean} ok
 * @property {string} [message]
 * @property {number} [amountCharged]
 * @property {number} [billableCount]
 * @property {number} [suspendedCount]
 * @property {number} [walletBalanceAfter]
 */

/**
 * @typedef {Object} SubUserBillingSummary
 * @property {number} freeLimit
 * @property {number} pricePerSeatKes
 * @property {number} totalSubUsers
 * @property {number} activeSubUsers
 * @property {number} billableCount
 * @property {number} monthlyChargeKes
 * @property {number} walletBalance
 * @property {boolean} canAffordNextCharge
 */

/**
 * @typedef {Object} SystemUser
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} password
 * @property {string} [phone]
 * @property {string} [department]
 * @property {string} [jobTitle]
 * @property {'user'|'admin'|'super_admin'} tier
 * @property {'Active'|'Suspended'} status
 * @property {boolean} isSystem
 * @property {boolean} mfaEnabled
 * @property {string} createdAt
 * @property {number} failedLoginAttempts
 * @property {string|null} lockedUntil
 * @property {string} [walletId]
 * @property {string} [parentUserId]
 * @property {boolean} [isSubUser]
 * @property {string[]} [subUserFeatures]
 * @property {number} [subUserPriceKes]
 */

/**
 * @typedef {Object} Wallet
 * @property {string} id
 * @property {string} userId
 * @property {string} currency
 * @property {number} balance
 * @property {number} held
 * @property {number} lifetimeTopUp
 * @property {number} lifetimeSpend
 * @property {boolean} autoTopUp
 * @property {number} autoTopUpTriggerKes
 * @property {number} autoTopUpAmountKes
 * @property {number} lowBalanceAlertKes
 * @property {boolean} overdraftAllowed
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} PaymentRecord
 * @property {string} id
 * @property {string} userId
 * @property {string} userName
 * @property {string} userEmail
 * @property {string} at
 * @property {string} channel
 * @property {string} method
 * @property {number} amount
 * @property {string} currency
 * @property {string} status
 * @property {string} reference
 * @property {string} gateway
 * @property {string} gatewayRef
 * @property {number} feeKes
 * @property {number} netKes
 * @property {string} walletTransactionId
 * @property {string} ip
 */

/**
 * @typedef {Object} WalletTransaction
 * @property {string} id
 * @property {string} walletId
 * @property {string} userId
 * @property {string} userName
 * @property {string} [actorUserId]
 * @property {string} [hostUserId]
 * @property {string} at
 * @property {'credit'|'debit'} direction
 * @property {string} kind
 * @property {number} amount
 * @property {string} reference
 * @property {string} description
 * @property {Record<string, string|number>} [meta]
 */

export const PermissionsEnum = Object.freeze({
  USERS_CREATE_SUB: 'users.create.sub',
  USERS_MANAGE_SUB: 'users.manage.sub',
});