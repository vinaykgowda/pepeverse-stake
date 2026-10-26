// backend/src/services/claimsMaintenance.js
// Central helper for the "staking claims disabled for maintenance" toggle.
//
// Controlled by two rows in the `settings` table:
//   claims_disabled             -> 'true' | 'false'
//   claims_maintenance_message  -> user-facing message
//
// Applies to BOTH main staking claims (POST /rewards/claim) and DAO staking
// claims (POST /dao-claim). Reward accrual and earnings display are NOT
// affected — only the act of claiming is blocked.

const { getPool } = require('../db');
const pool = getPool();

const DEFAULT_MESSAGE =
  'Staking reward claims are temporarily disabled for maintenance. ' +
  'Your NFTs keep earning and your balance is safe — you can claim once maintenance is complete.';

function isTruthy(value) {
  if (value === null || value === undefined) return false;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

// Returns { disabled: boolean, message: string }
async function getClaimsStatus() {
  try {
    const result = await pool.query(
      `SELECT key_name, value FROM settings
       WHERE key_name IN ('claims_disabled', 'claims_maintenance_message')`
    );
    const map = {};
    result.rows.forEach(r => { map[r.key_name] = r.value; });

    return {
      disabled: isTruthy(map['claims_disabled']),
      message: (map['claims_maintenance_message'] && String(map['claims_maintenance_message']).trim())
        || DEFAULT_MESSAGE
    };
  } catch (err) {
    // Fail OPEN is risky for a maintenance gate (it would let claims through),
    // but failing CLOSED on a transient DB error would block all claims.
    // We log and fail open so a settings-table hiccup never traps funds;
    // the toggle is an operational convenience, not a security control.
    console.error('⚠️ [CLAIMS] Could not read claims maintenance settings:', err.message);
    return { disabled: false, message: DEFAULT_MESSAGE };
  }
}

// Express guard. If claims are disabled, responds 503 and returns true
// (caller should stop). Otherwise returns false (caller proceeds).
async function blockIfClaimsDisabled(res) {
  const status = await getClaimsStatus();
  if (status.disabled) {
    res.status(503).json({
      success: false,
      claims_disabled: true,
      message: status.message
    });
    return true;
  }
  return false;
}

module.exports = { getClaimsStatus, blockIfClaimsDisabled, DEFAULT_MESSAGE };
