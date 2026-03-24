// scripts/backfill-traits.js
// Run: node scripts/backfill-traits.js <HELIUS_API_KEY>
const { Pool } = require('pg');
const https = require('https');

const DB_URL = 'postgresql://neondb_owner:npg_PjfK32trBAcQ@ep-twilight-thunder-ahej7jw2-pooler.c-3.us-east-1.aws.neon.tech/pepeverse_staking?sslmode=require';
const HELIUS_API_KEY = process.argv[2];

if (!HELIUS_API_KEY) {
  console.error('Usage: node scripts/backfill-traits.js <HELIUS_API_KEY>');
  process.exit(1);
}

const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

function heliusGetAsset(mintAddress) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'get-asset', method: 'getAsset', params: { id: mintAddress } });
    const url = new URL(HELIUS_URL);
    const options = {
      hostname: url.hostname, path: url.pathname + url.search,
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  const { rows } = await pool.query(
    `SELECT id, mint_address FROM staked_nfts WHERE traits IS NULL OR traits::text = '[]' OR traits::text = 'null'`
  );
  console.log(`Found ${rows.length} NFTs with empty traits`);

  for (const nft of rows) {
    try {
      console.log(`Fetching traits for ${nft.mint_address}...`);
      const res = await heliusGetAsset(nft.mint_address);
      const attributes = res?.result?.content?.metadata?.attributes || [];
      console.log(`  -> ${attributes.length} attributes:`, JSON.stringify(attributes));
      if (attributes.length > 0) {
        await pool.query('UPDATE staked_nfts SET traits = $1 WHERE id = $2', [JSON.stringify(attributes), nft.id]);
        console.log(`  -> Updated!`);
      } else {
        console.log(`  -> No attributes found`);
      }
    } catch (e) {
      console.error(`  -> Error: ${e.message}`);
    }
  }

  await pool.end();
  console.log('Done!');
}

main().catch(console.error);
