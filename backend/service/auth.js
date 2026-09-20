/**
 * backend/service/auth.js
 *
 * Loop 9C — Backend Authentication Router for Cognito Auth Migration.
 *
 * Implements:
 *   - POST /auth/signup — Pure Cognito + PostgreSQL user provisioning
 *   - POST /auth/login — Cognito authentication with HttpOnly refresh cookie issuance
 *   - POST /auth/refresh — Cognito REFRESH_TOKEN_AUTH using HttpOnly refresh cookie
 *   - POST /auth/logout — Clears HttpOnly refresh cookie
 *   - POST /auth/change-password — Password change for authenticated users
 */

'use strict';

const express = require('express');
const dotenv = require('dotenv');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const cognito = require('../auth/cognito');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

dotenv.config();

const router = express.Router();

// Helper: Get Cognito Identity Provider Client
function getCognitoClient() {
  const region = process.env.COGNITO_REGION || 'us-east-1';
  const config = { region };
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }
  return new CognitoIdentityProviderClient(config);
}

// ---------------------------------------------------------------------------
// Cookie Helpers (HttpOnly, Secure, SameSite, Max-Age)
// ---------------------------------------------------------------------------
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name ? name.trim() : '';
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    try {
      list[name] = decodeURIComponent(value);
    } catch {
      list[name] = value;
    }
  });
  return list;
}

function getCookie(req, name) {
  const cookies = parseCookies(req);
  return cookies[name] || null;
}

function getCookieOptions() {
  const sameSite = (process.env.COOKIE_SAMESITE || 'Lax').trim();
  const sameSiteLower = sameSite.toLowerCase();

  const isProd = process.env.NODE_ENV === 'production';
  const secure = isProd || sameSiteLower === 'none';

  const maxAgeRaw = process.env.COOKIE_MAX_AGE_SECONDS || '2592000';
  const maxAge = parseInt(maxAgeRaw, 10);
  if (isNaN(maxAge) || maxAge <= 0) {
    throw new Error('COOKIE_MAX_AGE_SECONDS must be a positive integer');
  }

  return { sameSite, secure, maxAge };
}

function setRefreshCookie(res, refreshToken) {
  const { sameSite, secure, maxAge } = getCookieOptions();
  let cookieStr = `poold_refresh_token=${encodeURIComponent(refreshToken)}; Path=/auth; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}`;
  if (secure) {
    cookieStr += '; Secure';
  }
  res.setHeader('Set-Cookie', cookieStr);
}

function clearRefreshCookie(res) {
  let sameSite = 'Lax';
  let secure = process.env.NODE_ENV === 'production';
  try {
    const opts = getCookieOptions();
    sameSite = opts.sameSite;
    secure = opts.secure;
  } catch {
    // fallback
  }

  let cookieStr = `poold_refresh_token=; Path=/auth; HttpOnly; SameSite=${sameSite}; Max-Age=0`;
  if (secure) {
    cookieStr += '; Secure';
  }
  res.setHeader('Set-Cookie', cookieStr);
}

// ---------------------------------------------------------------------------
// Role Validation for Public Signup
// ---------------------------------------------------------------------------
const ALLOWED_SIGNUP_ROLES = ['interviewer', 'interviewee'];

function validateSignupRoles(requestedRoles) {
  if (!Array.isArray(requestedRoles) || requestedRoles.length === 0) {
    return ['interviewee'];
  }
  const validated = requestedRoles
    .filter((r) => typeof r === 'string' && ALLOWED_SIGNUP_ROLES.includes(r.toLowerCase()))
    .map((r) => r.toLowerCase());
  if (validated.length === 0) {
    return ['interviewee'];
  }
  return [...new Set(validated)];
}

// ---------------------------------------------------------------------------
// POST /auth/signup — Cognito User Creation + PostgreSQL Provisioning
// ---------------------------------------------------------------------------
router.post('/signup', async (req, res) => {
  const { email, password, name, roles } = req.body || {};

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  const validatedRoles = validateSignupRoles(roles);
  const normalizedEmail = email.trim().toLowerCase();

  // Step 1: Create Cognito User
  let cognitoSub = null;
  try {
    const cognitoResult = await cognito.createUser(normalizedEmail, password, name);
    cognitoSub = cognitoResult ? cognitoResult.cognitoSub : null;
  } catch (cognitoErr) {
    return res.status(400).json({ error: cognitoErr.message || 'Failed to create Cognito account' });
  }

  // Step 2: PostgreSQL Database Provisioning
  let dbClient = null;
  const newAppUserId = crypto.randomUUID();

  try {
    dbClient = await db.getClient();
    await dbClient.query('BEGIN');

    const userInsertRes = await dbClient.query(
      'INSERT INTO app_users (id, cognito_sub, email) VALUES ($1, $2, $3) RETURNING id',
      [newAppUserId, cognitoSub, normalizedEmail]
    );
    const appUserId = userInsertRes.rows[0].id;

    await dbClient.query(
      'INSERT INTO profiles (user_id, email, name) VALUES ($1, $2, $3)',
      [appUserId, normalizedEmail, name]
    );

    for (const role of validatedRoles) {
      await dbClient.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [appUserId, role]
      );
    }

    await dbClient.query('COMMIT');

    return res.status(201).json({
      user: {
        id: appUserId,
        email: normalizedEmail,
        name,
        roles: validatedRoles,
      },
    });
  } catch (dbErr) {
    if (dbClient) {
      try { await dbClient.query('ROLLBACK'); } catch {}
    }

    // COMPENSATING ROLLBACK: Delete Cognito user if DB provisioning fails
    try {
      await cognito.deleteUser(normalizedEmail);
    } catch (cleanupErr) {
      console.warn('Warning: Rollback deletion of Cognito user failed:', cleanupErr.message);
    }

    return res.status(500).json({ error: dbErr.message || 'Failed to provision user in database' });
  } finally {
    if (dbClient) dbClient.release();
  }
});

// ---------------------------------------------------------------------------
// POST /auth/login — Cognito Authentication + HttpOnly Cookie Issuance
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Step 1: Authenticate against Cognito
    let cognitoTokens = null;
    let cognitoSub = null;

    try {
      cognitoTokens = await cognito.authenticateUser(normalizedEmail, password);
      if (cognitoTokens && cognitoTokens.idToken) {
        const decoded = jwt.decode(cognitoTokens.idToken);
        if (decoded && decoded.sub) {
          cognitoSub = decoded.sub;
        }
      }
    } catch (cognitoAuthErr) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!cognitoSub) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Step 2: Fetch corresponding PostgreSQL user identity mapping
    const { rows } = await db.query(
      'SELECT id, email FROM app_users WHERE cognito_sub = $1',
      [cognitoSub]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'User mapping not found for Cognito identity' });
    }

    const appUserId = rows[0].id;

    // Fetch profile & roles
    const [profileRes, rolesRes] = await Promise.all([
      db.query('SELECT name FROM profiles WHERE user_id = $1', [appUserId]),
      db.query('SELECT role FROM user_roles WHERE user_id = $1', [appUserId]),
    ]);

    const name = profileRes.rows[0]?.name || '';
    const roles = rolesRes.rows.map((r) => r.role);

    // Set HttpOnly refresh cookie if available
    if (cognitoTokens.refreshToken) {
      setRefreshCookie(res, cognitoTokens.refreshToken);
    }

    return res.json({
      user: {
        id: appUserId,
        email: normalizedEmail,
        name,
        roles,
      },
      session: {
        access_token: cognitoTokens.accessToken,
        expires_in: cognitoTokens.expiresIn || 3600,
        token_type: 'Bearer',
      },
    });
  } catch (error) {
    console.error('POST /auth/login error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to log in' });
  }
});

// ---------------------------------------------------------------------------
// POST /auth/refresh — Refresh Access Token via HttpOnly Cookie
// ---------------------------------------------------------------------------
router.post('/refresh', async (req, res) => {
  const refreshToken = getCookie(req, 'poold_refresh_token');

  if (!refreshToken) {
    return res.status(401).json({ error: 'Missing refresh token cookie' });
  }

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;

  if (!userPoolId || !clientId) {
    clearRefreshCookie(res);
    return res.status(500).json({ error: 'Cognito is not configured on backend' });
  }

  try {
    const client = getCognitoClient();
    const authCmd = new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const authRes = await client.send(authCmd);
    const result = authRes.AuthenticationResult;

    if (!result || !result.AccessToken) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // If Cognito issued a rotated refresh token, update the cookie
    if (result.RefreshToken) {
      setRefreshCookie(res, result.RefreshToken);
    }

    return res.json({
      access_token: result.AccessToken,
      expires_in: result.ExpiresIn || 3600,
      token_type: 'Bearer',
    });
  } catch (err) {
    console.error('POST /auth/refresh error:', err.message);
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// ---------------------------------------------------------------------------
// POST /auth/logout — Clear HttpOnly Refresh Cookie
// ---------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  clearRefreshCookie(res);
  return res.json({ message: 'Logged out successfully' });
});

// ---------------------------------------------------------------------------
// POST /auth/change-password — Password Change via Cognito Admin Command
// ---------------------------------------------------------------------------
router.post('/change-password', authenticate, async (req, res) => {
  const { newPassword } = req.body || {};

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!userPoolId) {
    return res.status(500).json({ error: 'Cognito is not configured on backend' });
  }

  try {
    const client = getCognitoClient();
    const setPasswordCmd = new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: req.user.email,
      Password: newPassword,
      Permanent: true,
    });

    await client.send(setPasswordCmd);
    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('POST /auth/change-password error:', err.message);
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

module.exports = router;