/**
 * Centralized PostgreSQL Connection Pool
 *
 * Provides a reusable connection pool for all backend database operations.
 * Supports both local PostgreSQL and Amazon RDS with optional SSL.
 *
 * Environment variables:
 *   DB_HOST     — PostgreSQL host (default: localhost)
 *   DB_PORT     — PostgreSQL port (default: 5432)
 *   DB_NAME     — database name (required)
 *   DB_USER     — database user (required)
 *   DB_PASSWORD  — database password (required)
 *   DB_SSL      — enable SSL: 'true' | 'require' | 'false' (default: false)
 */
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

// ---------------------------------------------------------------------------
// SSL configuration — environment-aware for local dev vs RDS
// ---------------------------------------------------------------------------
function getSslConfig() {
  const sslEnv = (process.env.DB_SSL || 'false').toLowerCase().trim();
  if (sslEnv === 'false' || sslEnv === '0' || sslEnv === '') {
    return false;
  }
  // For RDS: require SSL but accept the Amazon-issued certificate
  return { rejectUnauthorized: false };
}

// ---------------------------------------------------------------------------
// Pool creation — single instance, reused across all requests
// ---------------------------------------------------------------------------
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: getSslConfig(),

  // Pool behaviour
  max: 20,                    // maximum pool size
  idleTimeoutMillis: 30000,   // close idle clients after 30 s
  connectionTimeoutMillis: 5000, // fail if no connection within 5 s
});

// Log pool errors (but never log credentials)
pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL pool error:', err.message);
});

// Log successful first connect (once)
let _connected = false;
pool.on('connect', () => {
  if (!_connected) {
    _connected = true;
    console.log(`✅ PostgreSQL pool connected to ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || '(no DB_NAME)'}`);
  }
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a parameterized query against the pool.
 *
 * @param {string} text  — SQL string with $1, $2, … placeholders
 * @param {any[]}  params — values bound to the placeholders
 * @returns {Promise<import('pg').QueryResult>}
 *
 * @example
 *   const { rows } = await db.query(
 *     'SELECT * FROM job_postings WHERE user_id = $1',
 *     [userId]
 *   );
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Acquire a dedicated client from the pool (for transactions).
 *
 * IMPORTANT: Always release the client in a `finally` block.
 *
 * @returns {Promise<import('pg').PoolClient>}
 *
 * @example
 *   const client = await db.getClient();
 *   try {
 *     await client.query('BEGIN');
 *     await client.query('INSERT INTO …', [...]);
 *     await client.query('INSERT INTO …', [...]);
 *     await client.query('COMMIT');
 *   } catch (err) {
 *     await client.query('ROLLBACK');
 *     throw err;
 *   } finally {
 *     client.release();
 *   }
 */
async function getClient() {
  return pool.connect();
}

/**
 * Gracefully close the pool (called on process shutdown).
 */
async function close() {
  await pool.end();
  console.log('PostgreSQL pool closed.');
}

// Graceful shutdown on process exit signals
process.on('SIGINT', async () => {
  await close();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await close();
  process.exit(0);
});

module.exports = { query, getClient, close, pool };
