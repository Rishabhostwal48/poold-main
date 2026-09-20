const express = require('express');
const dotenv = require('dotenv');
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

dotenv.config();

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

async function getUserRoles(userId) {
  const { rows } = await db.query(
    'SELECT role FROM user_roles WHERE user_id = $1',
    [userId]
  );
  return rows.map(r => r.role);
}

async function requireInterviewerOrAdminRole(req, res) {
  const roles = await getUserRoles(req.user.id);
  const hasAllowedRole = roles.some(r => r === 'interviewer' || r === 'admin');
  if (!hasAllowedRole) {
    res.status(403).json({ error: 'Forbidden: Interviewer or admin role required' });
    return false;
  }
  return true;
}

router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /job-postings/active — list all active job postings (any authenticated user)
// Authorization: Supabase RLS allowed any authenticated user to read active postings.
//   Preserved: authentication required, no ownership check needed.
// ---------------------------------------------------------------------------
router.get('/active', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM job_postings WHERE status = $1 ORDER BY created_at DESC',
      ['active']
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error('List active job postings error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch active job postings' });
  }
});

// ---------------------------------------------------------------------------
// GET /job-postings — list current user's job postings
// Authorization: Supabase RLS enforced auth.uid() = user_id.
//   Preserved: WHERE user_id = req.user.id
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM job_postings WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error('List job postings error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch job postings' });
  }
});

// ---------------------------------------------------------------------------
// GET /job-postings/:id — get a single active job posting
// Authorization: Supabase RLS allowed any authenticated user to view active postings.
//   Preserved: only returns if status = 'active'.
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM job_postings WHERE id = $1 AND status = $2 LIMIT 1',
      [req.params.id, 'active']
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Job posting not found' });
    }
    return res.json({ data: rows[0] });
  } catch (err) {
    console.error('Get job posting error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch job posting' });
  }
});

// ---------------------------------------------------------------------------
// POST /job-postings — create a new job posting
// Authorization: Interviewer or Admin role required. Ownership bound to req.user.id.
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const allowed = await requireInterviewerOrAdminRole(req, res);
  if (!allowed) return;

  const values = pickFields(req.body);
  if (!values.title || !values.description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  try {
    // Build dynamic INSERT from the picked fields
    const cols = ['user_id', ...Object.keys(values)];
    const vals = [req.user.id, ...Object.values(values)];
    const placeholders = cols.map((_, i) => `$${i + 1}`);

    const { rows } = await db.query(
      `INSERT INTO job_postings (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      vals
    );
    return res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error('Create job posting error:', err.message);
    return res.status(500).json({ error: 'Failed to create job posting' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /job-postings/:id — update own job posting
// Authorization: Supabase RLS enforced auth.uid() = user_id for UPDATE.
//   Preserved: WHERE id = $id AND user_id = req.user.id
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const values = pickFields(req.body);
  if (Object.keys(values).length === 0) {
    return res.status(400).json({ error: 'No job posting fields provided' });
  }

  try {
    // Build dynamic SET clause: field1 = $1, field2 = $2, ...
    const entries = Object.entries(values);
    const setClauses = entries.map(([col], i) => `${col} = $${i + 1}`);
    const params = entries.map(([, val]) => val);
    // Append id and user_id as the last two params
    const idIdx = params.length + 1;
    const userIdx = params.length + 2;
    params.push(req.params.id, req.user.id);

    const { rows } = await db.query(
      `UPDATE job_postings SET ${setClauses.join(', ')} WHERE id = $${idIdx} AND user_id = $${userIdx} RETURNING *`,
      params
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Job posting not found' });
    }
    return res.json({ data: rows[0] });
  } catch (err) {
    console.error('Update job posting error:', err.message);
    return res.status(500).json({ error: 'Failed to update job posting' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /job-postings/:id — delete own job posting
// Authorization: Supabase RLS enforced auth.uid() = user_id for DELETE.
//   Preserved: WHERE id = $id AND user_id = req.user.id
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'DELETE FROM job_postings WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Job posting not found' });
    }
    return res.json({ data: rows[0] });
  } catch (err) {
    console.error('Delete job posting error:', err.message);
    return res.status(500).json({ error: 'Failed to delete job posting' });
  }
});

module.exports = router;