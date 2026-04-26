/**
 * DAO Snapshot Service
 *
 * Generates eligibility snapshots for DAO airdrop configs.
 * Called by the POST /dao-admin/airdrops/:id/activate endpoint.
 *
 * The caller is responsible for wrapping in a database transaction.
 * This function accepts an optional `client` (pg transaction client).
 * If no client is provided, the pool is used directly.
 *
 * Validates: Requirements 1.5, 3.4
 */

const database = require('./config/database');

/**
 * Generate a snapshot for a DAO airdrop config.
 *
 * @param {number} daoAirdropConfigId - The ID of the dao_airdrop_config to snapshot
 * @param {import('pg').PoolClient} [client] - Optional pg transaction client; uses pool if omitted
 * @returns {Promise<{ eligible_count: number, total_tokens: string }>}
 */
async function generateDaoSnapshot(daoAirdropConfigId, client) {
  const db = client || database;

  // 1. Fetch the dao_airdrop_config row
  const configResult = await db.query(
    `SELECT id, collection_id, airdrop_type, amount_per_nft,
            minimum_threshold, trait_type, trait_value, status
     FROM dao_airdrop_configs
     WHERE id = $1`,
    [daoAirdropConfigId]
  );

  if (configResult.rows.length === 0) {
    throw new Error(`DAO airdrop config not found: ${daoAirdropConfigId}`);
  }

  const config = configResult.rows[0];

  // 2. Query eligible wallets based on airdrop type
  let eligibleWallets;

  if (config.airdrop_type === 'threshold') {
    // Threshold type: wallets with staked NFT count >= minimum_threshold for the collection
    const result = await db.query(
      `SELECT owner_wallet AS wallet_address, COUNT(*) AS staked_count
       FROM staked_nfts
       WHERE collection_id = $1
       GROUP BY owner_wallet
       HAVING COUNT(*) >= $2`,
      [config.collection_id, config.minimum_threshold]
    );

    eligibleWallets = result.rows.map((row) => ({
      wallet_address: row.wallet_address,
      eligible_nft_count: parseInt(row.staked_count, 10),
      token_amount: (parseInt(row.staked_count, 10) * parseFloat(config.amount_per_nft)).toFixed(9),
    }));
  } else if (config.airdrop_type === 'trait') {
    // Trait type: wallets with at least one staked NFT matching trait_type + trait_value for the collection
    const traitFilter = JSON.stringify([
      { trait_type: config.trait_type, value: config.trait_value },
    ]);

    const result = await db.query(
      `SELECT owner_wallet AS wallet_address, COUNT(*) AS matching_count
       FROM staked_nfts
       WHERE collection_id = $1
         AND traits::jsonb @> $2::jsonb
       GROUP BY owner_wallet
       HAVING COUNT(*) > 0`,
      [config.collection_id, traitFilter]
    );

    eligibleWallets = result.rows.map((row) => ({
      wallet_address: row.wallet_address,
      eligible_nft_count: parseInt(row.matching_count, 10),
      token_amount: (parseInt(row.matching_count, 10) * parseFloat(config.amount_per_nft)).toFixed(9),
    }));
  } else {
    throw new Error(`Unknown airdrop_type: ${config.airdrop_type}`);
  }

  // 3. Insert eligible wallets into dao_airdrop_snapshots
  //    ON CONFLICT DO NOTHING makes this idempotent
  if (eligibleWallets.length > 0) {
    const walletAddresses = eligibleWallets.map((w) => w.wallet_address);
    const tokenAmounts = eligibleWallets.map((w) => w.token_amount);

    await db.query(
      `INSERT INTO dao_airdrop_snapshots
         (dao_airdrop_config_id, wallet_address, token_amount)
       SELECT $1,
              UNNEST($2::text[]),
              UNNEST($3::numeric[])
       ON CONFLICT (dao_airdrop_config_id, wallet_address) DO NOTHING`,
      [daoAirdropConfigId, walletAddresses, tokenAmounts]
    );
  }

  // 4. Compute and return summary
  const eligible_count = eligibleWallets.length;
  const total_tokens = eligibleWallets
    .reduce((sum, w) => sum + parseFloat(w.token_amount), 0)
    .toFixed(9);

  return { eligible_count, total_tokens };
}

module.exports = { generateDaoSnapshot };
