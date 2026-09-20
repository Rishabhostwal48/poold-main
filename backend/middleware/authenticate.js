const dotenv = require('dotenv');
const cognito = require('../auth/cognito');
const db = require('../db');

dotenv.config();

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed authorization header' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    const decoded = await cognito.verifyToken(token);
    if (!decoded || !decoded.sub) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    if (decoded.token_use !== 'access') {
      return res.status(401).json({ error: 'Invalid token_use claim: expected access' });
    }

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
    // return 401 Unauthorized.
    return res.status(401).json({ error: 'User mapping not found for Cognito identity' });
  } catch (cognitoErr) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

module.exports = { authenticate };

