const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const cognito = require('../auth/cognito');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

dotenv.config();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

router.options('/', (req, res) => {
  res.set(corsHeaders);
  res.sendStatus(200);
});

router.post('/', authenticate, async (req, res) => {
  res.set(corsHeaders);

  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Lookup user in app_users database table to retrieve cognito_sub and email
    const { rows } = await db.query(
      'SELECT id, cognito_sub, email FROM app_users WHERE id = $1',
      [userId]
    );

    const appUser = rows.length > 0 ? rows[0] : null;
    const emailToDelete = appUser ? appUser.email : userEmail;

    // 1. Delete from Cognito (if configured / present)
    if (emailToDelete) {
      try {
        await cognito.deleteUser(emailToDelete);
      } catch (cognitoErr) {
        console.warn('Warning: Delete Cognito user error:', cognitoErr.message);
      }
    }

    // 2. Delete from PostgreSQL database (Cascades to profiles, user_roles, etc.)
    await db.query('DELETE FROM app_users WHERE id = $1', [userId]);

    return res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete-user-account error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

module.exports = router;

