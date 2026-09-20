/**
 * backend/service/api.js
 *
 * Loop 6 — Centralized API endpoints replacing direct frontend Supabase DB access.
 *
 * All endpoints require authentication via the authenticate middleware
 * (Cognito JWT access tokens mapped to PostgreSQL app_users).
 *
 * Security rules enforced here:
 *   - Ownership: user-scoped queries always filter by req.user.id (server-side)
 *   - Authorization: admin endpoints require role check from user_roles table
 *   - Parameterized SQL: all queries use $N placeholders
 *   - No sensitive data returned (no tokens, no credentials, no stack traces)
 *   - No client-supplied user IDs trusted
 */

'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

// ---------------------------------------------------------------------------
// Helper: check if authenticated user has a specific role
// ---------------------------------------------------------------------------
async function getUserRoles(userId) {
  const { rows } = await db.query(
    'SELECT role FROM user_roles WHERE user_id = $1',
    [userId]
  );
  return rows.map(r => r.role);
}

async function requireRole(req, res, allowedRoles) {
  const roles = await getUserRoles(req.user.id);
  const hasRole = roles.some(r => allowedRoles.includes(r));
  if (!hasRole) {
    res.status(403).json({ error: 'Forbidden: insufficient role' });
    return false;
  }
  return true;
}

// All routes in this file require authentication
router.use(authenticate);

// ===========================================================================
// GET /api/me/stats
// Returns count of CV analyses, gap analyses, and interview sessions for the
// authenticated interviewee.
//
// Authorization: any authenticated user (counts their own records only)
// Ownership: enforced via WHERE user_id/candidate_id = req.user.id
// ===========================================================================
router.get('/me/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    const [cvRes, gapRes, interviewRes] = await Promise.all([
      db.query(
        'SELECT COUNT(*) AS count FROM cv_analysis_results WHERE user_id = $1',
        [userId]
      ),
      db.query(
        'SELECT COUNT(*) AS count FROM gap_analysis_results WHERE user_id = $1',
        [userId]
      ),
      db.query(
        'SELECT COUNT(*) AS count FROM interview_sessions WHERE candidate_id = $1',
        [userId]
      ),
    ]);

    return res.json({
      cvAnalyses: parseInt(cvRes.rows[0].count, 10),
      gapAnalyses: parseInt(gapRes.rows[0].count, 10),
      interviews: parseInt(interviewRes.rows[0].count, 10),
    });
  } catch (err) {
    console.error('GET /api/me/stats error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// ===========================================================================
// GET /api/me/role
// Returns the authenticated user's roles from the user_roles table.
//
// Authorization: any authenticated user (reads own roles only)
// ===========================================================================
router.get('/me/role', async (req, res) => {
  try {
    const roles = await getUserRoles(req.user.id);
    return res.json({ roles });
  } catch (err) {
    console.error('GET /api/me/role error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch user roles' });
  }
});

// ===========================================================================
// POST /api/cv-analysis
// Save a CV analysis result for the authenticated user.
//
// Authorization: any authenticated user
// Ownership: user_id is always set to req.user.id (never trusted from client)
// ===========================================================================
router.post('/cv-analysis', async (req, res) => {
  const { file_name, file_size, candidate_profile } = req.body || {};

  if (!file_name || !candidate_profile) {
    return res.status(400).json({ error: 'file_name and candidate_profile are required' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO cv_analysis_results (user_id, file_name, file_size, candidate_profile)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, file_name, file_size, candidate_profile, processed_at, created_at, updated_at`,
      [req.user.id, file_name, file_size || null, JSON.stringify(candidate_profile)]
    );
    return res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error('POST /api/cv-analysis error:', err.message);
    return res.status(500).json({ error: 'Failed to save CV analysis' });
  }
});

// ===========================================================================
// GET /api/cv-analysis
// List the authenticated user's CV analysis results, ordered by created_at DESC.
//
// Authorization: any authenticated user
// Ownership: enforced via WHERE user_id = req.user.id
// ===========================================================================
router.get('/cv-analysis', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, user_id, file_name, file_size, candidate_profile, processed_at, created_at, updated_at
       FROM cv_analysis_results
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error('GET /api/cv-analysis error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch CV analyses' });
  }
});

// ===========================================================================
// POST /api/gap-analysis
// Save a gap analysis result for the authenticated user.
//
// Authorization: any authenticated user
// Ownership: user_id is always set to req.user.id
// ===========================================================================
router.post('/gap-analysis', async (req, res) => {
  const {
    cv_analysis_id,
    job_profile,
    gap_analysis,
    robust_gap_analysis,
    job_description,
    job_posting_id,
  } = req.body || {};

  if (!job_profile || !job_description) {
    return res.status(400).json({ error: 'job_profile and job_description are required' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO gap_analysis_results
         (user_id, cv_analysis_id, job_posting_id, job_profile, gap_analysis, robust_gap_analysis, job_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, cv_analysis_id, job_posting_id, job_profile, gap_analysis, robust_gap_analysis,
                 job_description, created_at, updated_at`,
      [
        req.user.id,
        cv_analysis_id || null,
        job_posting_id || null,
        JSON.stringify(job_profile),
        gap_analysis ? JSON.stringify(gap_analysis) : null,
        robust_gap_analysis ? JSON.stringify(robust_gap_analysis) : null,
        job_description,
      ]
    );
    return res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error('POST /api/gap-analysis error:', err.message);
    return res.status(500).json({ error: 'Failed to save gap analysis' });
  }
});

// ===========================================================================
// GET /api/gap-analysis
// List the authenticated user's gap analysis results, ordered by created_at DESC.
//
// Authorization: any authenticated user
// Ownership: enforced via WHERE user_id = req.user.id
// ===========================================================================
router.get('/gap-analysis', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, user_id, cv_analysis_id, job_posting_id, job_profile, gap_analysis,
              robust_gap_analysis, job_description, created_at, updated_at
       FROM gap_analysis_results
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error('GET /api/gap-analysis error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch gap analyses' });
  }
});

// ===========================================================================
// GET /api/interviewer/dashboard
// Returns all data for the interviewer dashboard in a single request:
//   - interview sessions (recruiter_id = caller) with candidate profiles, job title,
//     response count, and interview analysis
//   - gap analyses linked to sessions or the recruiter's job postings
//   - interview responses with associated question text
//
// Authorization: authenticated user
// Ownership: all queries scoped to req.user.id as recruiter
// ===========================================================================
router.get('/interviewer/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;

    // Step 1: Get interview sessions for this recruiter
    const { rows: sessions } = await db.query(
      `SELECT
         s.id, s.candidate_id, s.job_posting_id, s.recruiter_id,
         s.status, s.scheduled_at, s.started_at, s.completed_at, s.created_at,
         jp.title AS job_title
       FROM interview_sessions s
       LEFT JOIN job_postings jp ON jp.id = s.job_posting_id
       WHERE s.recruiter_id = $1
       ORDER BY s.created_at DESC`,
      [userId]
    );

    const sessionIds = sessions.map(s => s.id);
    const candidateIds = [...new Set(sessions.map(s => s.candidate_id))];

    // Step 2: Get candidate profiles
    let profiles = [];
    if (candidateIds.length > 0) {
      const placeholders = candidateIds.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await db.query(
        `SELECT user_id, name, email FROM profiles WHERE user_id IN (${placeholders})`,
        candidateIds
      );
      profiles = rows;
    }

    // Step 3: Get response counts per session
    let responseCounts = [];
    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await db.query(
        `SELECT interview_session_id, COUNT(*) AS count
         FROM interview_responses
         WHERE interview_session_id IN (${placeholders})
         GROUP BY interview_session_id`,
        sessionIds
      );
      responseCounts = rows;
    }

    // Step 4: Get interview analysis per session
    let analyses = [];
    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await db.query(
        `SELECT id, interview_session_id, overall_score, technical_score,
                communication_score, cultural_fit_score, strengths, weaknesses,
                recommendations, ai_summary, final_decision, notes, created_at
         FROM interview_analysis
         WHERE interview_session_id IN (${placeholders})`,
        sessionIds
      );
      analyses = rows;
    }

    // Step 5: Enrich sessions with candidate info, response counts, analysis
    const enrichedSessions = sessions.map(session => {
      const profile = profiles.find(p => p.user_id === session.candidate_id);
      const responseRow = responseCounts.find(r => r.interview_session_id === session.id);
      const sessionAnalyses = analyses.filter(a => a.interview_session_id === session.id);
      return {
        ...session,
        candidate_name: profile?.name || 'Unknown',
        candidate_email: profile?.email || '',
        response_count: responseRow ? parseInt(responseRow.count, 10) : 0,
        interview_analysis: sessionAnalyses,
      };
    });

    // Step 6: Get gap analyses for recruiter's candidates or job postings
    const jobIds = [...new Set(sessions.filter(s => s.job_posting_id).map(s => s.job_posting_id))];

    let gapAnalyses = [];
    if (candidateIds.length > 0 || jobIds.length > 0) {
      const conditions = [];
      const params = [];
      let paramIdx = 1;

      if (candidateIds.length > 0) {
        const ph = candidateIds.map(() => `$${paramIdx++}`).join(', ');
        params.push(...candidateIds);
        conditions.push(`g.user_id IN (${ph})`);
      }
      if (jobIds.length > 0) {
        const ph = jobIds.map(() => `$${paramIdx++}`).join(', ');
        params.push(...jobIds);
        conditions.push(`g.job_posting_id IN (${ph})`);
      }

      const { rows } = await db.query(
        `SELECT
           g.id, g.user_id, g.cv_analysis_id, g.job_posting_id, g.job_profile,
           g.gap_analysis, g.robust_gap_analysis, g.job_description, g.created_at, g.updated_at,
           jp.title AS job_posting_title
         FROM gap_analysis_results g
         LEFT JOIN job_postings jp ON jp.id = g.job_posting_id
         WHERE ${conditions.join(' OR ')}
         ORDER BY g.created_at DESC`,
        params
      );

      gapAnalyses = rows.map(gap => {
        const profile = profiles.find(p => p.user_id === gap.user_id);
        return {
          ...gap,
          candidate_name: profile?.name || 'Unknown',
          candidate_email: profile?.email || '',
        };
      });
    }

    // Step 7: Get interview responses with question text for recruiter's sessions
    let responses = [];
    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await db.query(
        `SELECT
           r.id, r.interview_session_id, r.response_text, r.transcript,
           r.duration_seconds, r.ai_analysis, r.score, r.created_at,
           q.question_text, q.question_type
         FROM interview_responses r
         LEFT JOIN interview_questions q ON q.id = r.question_id
         WHERE r.interview_session_id IN (${placeholders})
         ORDER BY r.created_at DESC`,
        sessionIds
      );
      responses = rows;
    }

    return res.json({
      sessions: enrichedSessions,
      gap_analyses: gapAnalyses,
      responses,
    });
  } catch (err) {
    console.error('GET /api/interviewer/dashboard error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch interviewer dashboard data' });
  }
});

// ===========================================================================
// GET /api/admin/statistics
// Returns platform admin statistics (last 30 days, newest first).
//
// Authorization: admin role required
// ===========================================================================
router.get('/admin/statistics', async (req, res) => {
  try {
    const allowed = await requireRole(req, res, ['admin']);
    if (!allowed) return;

    const { rows } = await db.query(
      `SELECT id, date, total_interviews, total_cv_analyses, total_gap_analyses,
              ai_api_calls, estimated_cost_usd, processing_time_seconds, created_at
       FROM admin_statistics
       ORDER BY date DESC
       LIMIT 30`
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error('GET /api/admin/statistics error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch admin statistics' });
  }
});

// ===========================================================================
// GET /api/admin/users/count
// Returns total number of registered users (from profiles table).
//
// Authorization: admin role required
// ===========================================================================
router.get('/admin/users/count', async (req, res) => {
  try {
    const allowed = await requireRole(req, res, ['admin']);
    if (!allowed) return;

    const { rows } = await db.query('SELECT COUNT(*) AS count FROM profiles');
    return res.json({ count: parseInt(rows[0].count, 10) });
  } catch (err) {
    console.error('GET /api/admin/users/count error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch user count' });
  }
});

// ===========================================================================
// POST /api/applications
// Create a job application for the authenticated user.
//
// Authorization: any authenticated user
// Ownership: applicant_id is always set to req.user.id
// IDOR prevention: frontend cannot supply a different applicant_id
// ===========================================================================
router.post('/applications', async (req, res) => {
  const { opportunity_id, status } = req.body || {};

  if (!opportunity_id) {
    return res.status(400).json({ error: 'opportunity_id is required' });
  }

  try {
    // Verify the job posting exists and is active
    const { rows: jobRows } = await db.query(
      `SELECT id FROM job_postings WHERE id = $1 AND status = 'active'`,
      [opportunity_id]
    );
    if (jobRows.length === 0) {
      return res.status(404).json({ error: 'Job posting not found or not active' });
    }

    const { rows } = await db.query(
      `INSERT INTO applications (opportunity_id, applicant_id, status)
       VALUES ($1, $2, $3)
       RETURNING id, opportunity_id, applicant_id, status, created_at, updated_at`,
      [opportunity_id, req.user.id, status || 'pending']
    );
    return res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error('POST /api/applications error:', err.message);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Application already exists' });
    }
    return res.status(500).json({ error: 'Failed to create application' });
  }
});

// ===========================================================================
// POST /api/interview-sessions
// Create an interview session for the authenticated candidate.
//
// Authorization: any authenticated user
// Ownership: candidate_id is always set to req.user.id
// Security: recruiter_id is resolved from job_posting.user_id server-side
//           unless explicitly provided AND the job exists (prevents spoofing)
// ===========================================================================
router.post('/interview-sessions', async (req, res) => {
  const { job_posting_id, recruiter_id, status } = req.body || {};

  if (!job_posting_id) {
    return res.status(400).json({ error: 'job_posting_id is required' });
  }

  try {
    // Resolve recruiter_id from the job posting to prevent IDOR
    // Even if recruiter_id is supplied by client, we verify it matches job owner
    const { rows: jobRows } = await db.query(
      `SELECT id, user_id FROM job_postings WHERE id = $1`,
      [job_posting_id]
    );
    if (jobRows.length === 0) {
      return res.status(404).json({ error: 'Job posting not found' });
    }

    const resolvedRecruiterId = jobRows[0].user_id;

    const { rows } = await db.query(
      `INSERT INTO interview_sessions (job_posting_id, candidate_id, recruiter_id, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, job_posting_id, candidate_id, recruiter_id, status,
                 scheduled_at, started_at, completed_at, created_at, updated_at`,
      [job_posting_id, req.user.id, resolvedRecruiterId, status || 'scheduled']
    );
    return res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error('POST /api/interview-sessions error:', err.message);
    return res.status(500).json({ error: 'Failed to create interview session' });
  }
});

module.exports = router;
