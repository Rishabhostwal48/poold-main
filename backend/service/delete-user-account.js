const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const cognito = require('../auth/cognito');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});


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

    // 2. Delete from Supabase Auth (transitional)
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch (sbErr) {
      console.warn('Warning: Delete Supabase user error:', sbErr.message);
    }

    // 3. Delete from PostgreSQL database (Cascades to profiles, user_roles, etc.)
    await db.query('DELETE FROM app_users WHERE id = $1', [userId]);

    return res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete-user-account error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

module.exports = router;
