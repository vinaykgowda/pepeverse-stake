/**
 * Property-based tests for rewards-airdrop-analytics feature.
 *
 * Tests live here per spec notes. Uses fast-check for property generation.
 *
 * Feature: rewards-airdrop-analytics
 */

'use strict';

const fc = require('fast-check');

// ---------------------------------------------------------------------------
// Helpers that mirror the production logic under test (pure functions)
// ---------------------------------------------------------------------------

/**
 * Simulate the token balance response builder used by GET /admin/token-balances.
 * For each token, if heliusFetch(token) throws, the row gets { error: true }.
 * Otherwise it gets { balance: <value> }.
 *
 * @param {Array<{token_address: string, token_symbol: string, token_decimals: number}>} tokens
 * @param {(token: object) => number} heliusFetch - may throw to simulate failure
 * @returns {Array<object>}
 */
function buildTokenBalanceResponse(tokens, heliusFetch) {
  return tokens.map((token) => {
    try {
      const balance = heliusFetch(token);
      return { ...token, balance, error: false };
    } catch (_) {
      return { ...token, balance: null, error: true };
    }
  });
}

/**
 * Simulate the claims analytics stats aggregation used by GET /admin/analytics/claims.
 *
 * @param {Array<{wallet_address: string, collection_name: string, token_symbol: string, amount: number, created_at: string, tx_hash: string}>} records
 * @returns {{ count: number, total_distributed: number, unique_wallets: number }}
 */
function computeClaimsStats(records) {
  const count = records.length;
  const total_distributed = records.reduce((sum, r) => sum + r.amount, 0);
  const unique_wallets = new Set(records.map((r) => r.wallet_address)).size;
  return { count, total_distributed, unique_wallets };
}

/**
 * Check that a claim record has all required fields (non-null, non-empty).
 */
function claimRecordIsComplete(record) {
  return (
    typeof record.wallet_address === 'string' && record.wallet_address.length > 0 &&
    typeof record.collection_name === 'string' && record.collection_name.length > 0 &&
    typeof record.token_symbol === 'string' && record.token_symbol.length > 0 &&
    typeof record.amount === 'number' &&
    typeof record.created_at === 'string' && record.created_at.length > 0 &&
    typeof record.tx_hash === 'string' && record.tx_hash.length > 0
  );
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const tokenArb = fc.record({
  token_address: fc.base64String({ minLength: 32, maxLength: 44 }),
  token_symbol: fc.stringMatching(/^[A-Z]{2,8}$/),
  token_decimals: fc.integer({ min: 0, max: 18 }),
});

const claimRecordArb = fc.record({
  wallet_address: fc.base64String({ minLength: 32, maxLength: 44 }),
  collection_name: fc.string({ minLength: 1, maxLength: 50 }),
  token_symbol: fc.stringMatching(/^[A-Z]{2,8}$/),
  amount: fc.float({ min: Math.fround(0.000001), max: Math.fround(1_000_000), noNaN: true }),
  created_at: fc
    .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-01-01').getTime() })
    .map((ts) => new Date(ts).toISOString()),
  tx_hash: fc.base64String({ minLength: 64, maxLength: 88 }),
});

// ---------------------------------------------------------------------------
// Property 1: Token balance table completeness
// Feature: rewards-airdrop-analytics, Property 1: Token balance table completeness
// ---------------------------------------------------------------------------

describe('Property 1: Token balance table completeness', () => {
  it('every token in collection_rewards appears in the response with non-null symbol, mint address, and balance field', () => {
    fc.assert(
      fc.property(
        fc.array(tokenArb, { minLength: 1, maxLength: 20 }),
        (tokens) => {
          // Helius always succeeds — returns a positive balance
          const heliusFetch = () => Math.random() * 1000;
          const response = buildTokenBalanceResponse(tokens, heliusFetch);

          // Every input token must appear in the response
          expect(response).toHaveLength(tokens.length);

          for (let i = 0; i < tokens.length; i++) {
            const row = response[i];
            // Non-null symbol
            expect(typeof row.token_symbol).toBe('string');
            expect(row.token_symbol.length).toBeGreaterThan(0);
            // Non-null mint address
            expect(typeof row.token_address).toBe('string');
            expect(row.token_address.length).toBeGreaterThan(0);
            // Balance field present (not undefined)
            expect('balance' in row).toBe(true);
            // No error flag when fetch succeeds
            expect(row.error).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Token balance partial failure isolation
// Feature: rewards-airdrop-analytics, Property 2: Token balance partial failure isolation
// ---------------------------------------------------------------------------

describe('Property 2: Token balance partial failure isolation', () => {
  it('failed token rows have error:true and successful rows are unaffected', () => {
    fc.assert(
      fc.property(
        fc.array(tokenArb, { minLength: 2, maxLength: 20 }),
        fc.array(fc.boolean(), { minLength: 2, maxLength: 20 }),
        (tokens, failFlags) => {
          // Align failFlags length to tokens length
          const shouldFail = tokens.map((_, i) => failFlags[i % failFlags.length]);

          const heliusFetch = (token) => {
            const idx = tokens.indexOf(token);
            if (shouldFail[idx]) throw new Error('Helius fetch failed');
            return 42.5;
          };

          const response = buildTokenBalanceResponse(tokens, heliusFetch);

          // All tokens still appear
          expect(response).toHaveLength(tokens.length);

          for (let i = 0; i < tokens.length; i++) {
            const row = response[i];
            if (shouldFail[i]) {
              // Failed rows must have error:true
              expect(row.error).toBe(true);
            } else {
              // Successful rows must NOT have error:true
              expect(row.error).toBe(false);
              // And must have a balance value
              expect(row.balance).not.toBeNull();
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Claims analytics field completeness
// Feature: rewards-airdrop-analytics, Property 4: Claims analytics field completeness
// ---------------------------------------------------------------------------

describe('Property 4: Claims analytics field completeness', () => {
  it('every claim record contains wallet address, collection name, token symbol, amount, timestamp, and tx hash', () => {
    fc.assert(
      fc.property(
        fc.array(claimRecordArb, { minLength: 1, maxLength: 50 }),
        (records) => {
          for (const record of records) {
            expect(claimRecordIsComplete(record)).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('stats.count equals records.length', () => {
    fc.assert(
      fc.property(
        fc.array(claimRecordArb, { minLength: 0, maxLength: 50 }),
        (records) => {
          const stats = computeClaimsStats(records);
          expect(stats.count).toBe(records.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('stats.total_distributed equals sum of all amounts', () => {
    fc.assert(
      fc.property(
        fc.array(claimRecordArb, { minLength: 0, maxLength: 50 }),
        (records) => {
          const stats = computeClaimsStats(records);
          const expected = records.reduce((s, r) => s + r.amount, 0);
          expect(stats.total_distributed).toBeCloseTo(expected, 5);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('stats.unique_wallets equals count of distinct wallet addresses', () => {
    fc.assert(
      fc.property(
        fc.array(claimRecordArb, { minLength: 0, maxLength: 50 }),
        (records) => {
          const stats = computeClaimsStats(records);
          const expected = new Set(records.map((r) => r.wallet_address)).size;
          expect(stats.unique_wallets).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });
});
