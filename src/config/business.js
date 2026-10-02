// Business model constants — single source of truth.
// Owner pool + minimum payout are consumed by the Phase-4 payout engine;
// trial/grace are enforced by User defaults, paywall middleware, and the app.
const TRIAL_YEARS = Number(process.env.TRIAL_YEARS || 3);

// Royalty split of subscription revenue (must sum to 100).
const OWNER_POOL_PERCENT = Number(process.env.ROYALTY_OWNER_PERCENT || 55);
const PLATFORM_PERCENT = Number(process.env.ROYALTY_PLATFORM_PERCENT || 45);

// Balances below this are rolled over instead of paid out.
const MIN_PAYOUT_MMK = Number(process.env.MIN_PAYOUT_MMK || 10000);

// Days after expiry with full access + banner before the renew wall.
const GRACE_DAYS = Number(process.env.SUBSCRIPTION_GRACE_DAYS || 7);

module.exports = {
  TRIAL_YEARS,
  OWNER_POOL_PERCENT,
  PLATFORM_PERCENT,
  MIN_PAYOUT_MMK,
  GRACE_DAYS,
};
