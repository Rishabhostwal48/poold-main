const express = require('express');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

router.post('/signup', async (req, res) => {
  const { email, password, name, roles } = req.body || {};

  if (!email || !password || !name || !Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ error: 'Email, password, name, and at least one role are required' });
  }

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, roles },
    });

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ user: data.user });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create account' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return res.status(401).json({ error: error.message });
    return res.json({ user: data.user, session: data.session });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to log in' });
  }
});

module.exports = router;