const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const cognito = require('../auth/cognito');
const db = require('../db');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});


async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed authorization header' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  // -------------------------------------------------------------------------
  // Step 1: Try Cognito JWT Verification (Primary)
  // -------------------------------------------------------------------------
  try {
    const decoded = await cognito.verifyToken(token);
    if (decoded && decoded.sub) {
      const cognitoSub = decoded.sub;

      // Lookup user in PostgreSQL app_users table by cognito_sub
      const { rows } = await db.query(
        'SELECT id, email FROM app_users WHERE cognito_sub = $1',
        [cognitoSub]
      );

      if (rows.length > 0) {
        req.user = {
          id: rows[0].id,
          email: rows[0].email,
        };
        return next();
      }

      // CRITICAL SECURITY RULE: If token is a valid Cognito token but cognito_sub is NOT mapped in app_users,
      // DO NOT fall back to email search or auto-link. Return 401 Unauthorized.
      return res.status(401).json({ error: 'User mapping not found for Cognito identity' });
    }
  } catch (cognitoErr) {
    // Token is not a valid Cognito JWT or Cognito is unconfigured; proceed to Supabase fallback
  }

  // -------------------------------------------------------------------------
  // Step 2: Transitional Supabase Auth Fallback
  // -------------------------------------------------------------------------
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
    };
    return next();
  } catch (supabaseErr) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

module.exports = { authenticate };
