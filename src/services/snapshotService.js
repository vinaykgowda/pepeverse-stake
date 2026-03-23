/**
 * Snapshot Service
 * Generates eligibility snapshots for airdrop configs.
 */

async function generateSnapshot(airdropConfigId, client) {
  const configResult = await client.query(
    `SELECT id, collection_id, airdrop_type, amount_per_nft,
            minimum_threshold, trait_type, trait_value, status
     FROM airdrop_configs WHERE id = $1`,
    [airdropConfigId]
  );

  if (configResult.rows.length === 0) {
    throw new Error(`Airdrop config not found: ${airdropConfigId}`);
  }

  const config = configResult.rows[0];
  let eligibleWallets;

  if (config.airdrop_type === 'threshold') {
    const result = await client.query(
      `SELECT wallet_address, COUNT(*) AS staked_count
       FROM staked_nfts WHERE collection_id = $1
       GROUP BY wallet_address HAVING COUNT(*) >= $2`,
      [config.collection_id, config.minimum_threshold]
    );
    eligibleWallets = result.rows.map((row) => ({
      wallet_address: row.wallet_address,
      eligible_nft_count: parseInt(row.staked_count, 10),
      token_amount: (parseInt(row.staked_count, 10) * parseFloat(config.amount_per_nft)).toFixed(9),
    }));
  } else if (config.airdrop_type === 'trait') {
    const traitFilter = JSON.stringify([{ trait_type: config.trait_type, value: config.trait_value }]);
    const result = await client.query(
      `SELECT wallet_address, COUNT(*) AS matching_count
       FROM staked_nfts WHERE collection_id = $1 AND traits::jsonb @> $2::jsonb
       GROUP BY wallet_address HAVING COUNT(*) > 0`,
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

  if (eligibleWallets.length > 0) {
    await client.query(
      `INSERT INTO airdrop_snapshots (airdrop_config_id, wallet_address, eligible_nft_count, token_amount)
       SELECT $1, UNNEST($2::text[]), UNNEST($3::integer[]), UNNEST($4::numeric[])`,
      [airdropConfigId, eligibleWallets.map(w => w.wallet_address), eligibleWallets.map(w => w.eligible_nft_count), eligibleWallets.map(w => w.token_amount)]
    );
  }

  await client.query(
    `UPDATE airdrop_configs SET status = 'active', activated_at = NOW(), expires_at = NOW() + INTERVAL '7 days', updated_at = NOW() WHERE id = $1`,
    [airdropConfigId]
  );

  const eligible_count = eligibleWallets.length;
  const total_tokens = eligibleWallets.reduce((sum, w) => sum + parseFloat(w.token_amount), 0).toFixed(9);
  return { eligible_count, total_tokens };
}

module.exports = { generateSnapshot };
