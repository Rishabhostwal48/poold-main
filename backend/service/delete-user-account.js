const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
dotenv.config();

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

router.options('/', (req, res) => {
  res.set(corsHeaders);
  res.sendStatus(200);
});

router.post('/', async (req, res) => {
  res.set(corsHeaders);

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || '';
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const supabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const authHeader = req.get('Authorization') || req.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    const user = userData?.user;

    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete the user account (admin)
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Delete user error:', deleteError);
      return res.status(500).json({ error: deleteError.message || 'Failed to delete user' });
    }

    return res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete-user-account error:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(400).json({ error: message });
  }
});

module.exports = router;
