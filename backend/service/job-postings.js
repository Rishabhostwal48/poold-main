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

async function authenticate(req, res, next) {
  const authHeader = req.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.user = data.user;
  next();
}

const fields = [
  'title',
  'company_name',
  'description',
  'requirements',
  'location',
  'salary_range',
  'employment_type',
  'status',
];

function pickFields(body) {
  return fields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(body || {}, field)) {
      result[field] = body[field];
    }
    return result;
  }, {});
}

router.use(authenticate);

router.get('/active', async (req, res) => {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('List active job postings error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch active job postings' });
  }

  return res.json({ data: data || [] });
});

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('List job postings error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch job postings' });
  }

  return res.json({ data: data || [] });
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', req.params.id)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('Get job posting error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch job posting' });
  }
  if (!data) return res.status(404).json({ error: 'Job posting not found' });

  return res.json({ data });
});

router.post('/', async (req, res) => {
  const values = pickFields(req.body);
  if (!values.title || !values.description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  const { data, error } = await supabase
    .from('job_postings')
    .insert({ ...values, user_id: req.user.id })
    .select('*')
    .single();

  if (error) {
    console.error('Create job posting error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create job posting' });
  }

  return res.status(201).json({ data });
});

router.patch('/:id', async (req, res) => {
  const values = pickFields(req.body);
  if (Object.keys(values).length === 0) {
    return res.status(400).json({ error: 'No job posting fields provided' });
  }

  const { data, error } = await supabase
    .from('job_postings')
    .update(values)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Update job posting error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update job posting' });
  }
  if (!data) return res.status(404).json({ error: 'Job posting not found' });

  return res.json({ data });
});

router.delete('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('job_postings')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Delete job posting error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete job posting' });
  }
  if (!data) return res.status(404).json({ error: 'Job posting not found' });

  return res.json({ data });
});

module.exports = router;