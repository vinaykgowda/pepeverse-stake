-- ============================================================
-- Claims maintenance toggle
-- ============================================================
-- Adds settings that let an operator disable staking reward claims
-- (both main staking and DAO staking) for maintenance, without
-- affecting reward accrual or the earnings display.
--
-- Enforced by backend/src/services/claimsMaintenance.js at:
--   POST /api/v1/rewards/claim   (main staking)
--   POST /api/v1/user/dao-claim  (DAO staking)
-- Exposed to the frontend via GET /api/v1/settings/public.
--
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
-- Defaults to DISABLED=false so existing/new deployments keep claims on.
-- To turn maintenance ON:
--   UPDATE settings SET value='true', updated_at=NOW() WHERE key_name='claims_disabled';
-- To turn maintenance OFF:
--   UPDATE settings SET value='false', updated_at=NOW() WHERE key_name='claims_disabled';
-- ============================================================

INSERT INTO settings (key_name, value, description)
VALUES
  ('claims_disabled', 'false',
   'When true, main + DAO staking reward claims are blocked for maintenance (earning/display unaffected)'),
  ('claims_maintenance_message',
   'Staking reward claims are temporarily disabled for maintenance. Your NFTs keep earning and your balance is safe — you can claim once maintenance is complete.',
   'User-facing message shown while staking claims are disabled')
ON CONFLICT (key_name) DO NOTHING;
