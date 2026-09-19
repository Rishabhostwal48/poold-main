-- =============================================================================
-- AWS RDS PostgreSQL Schema for Poold / Vocal Recruiter
-- =============================================================================
-- Generated: 2026-09-19
-- Validated: 2026-09-19 (stress-test corrections applied)
-- Target: Amazon RDS PostgreSQL 15+
-- Purpose: Replace Supabase-hosted PostgreSQL with clean, portable schema
-- 
-- ZERO Supabase dependencies (no auth.users, auth.uid(), storage.*, RLS)
-- Authorization is enforced at the Express backend layer via Cognito JWT.
--
-- Cognito identity model:
--   app_users.id         UUID   — stable internal PK (preserves Supabase UUIDs)
--   app_users.cognito_sub TEXT  — Cognito "sub" claim (opaque string, NOT assumed UUID)
-- =============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- for gen_random_uuid()

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'interviewer', 'interviewee');

-- =============================================================================
-- UTILITY FUNCTIONS (that do NOT reference other tables)
-- =============================================================================

-- Auto-update updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- =============================================================================
-- CORE IDENTITY TABLES (replaces Supabase auth.users)
-- =============================================================================

-- app_users: Central identity table. Each row corresponds to a Cognito user.
--
-- Identity model:
--   app_users.id          — UUID primary key, preserved from Supabase auth.users.id
--                           during migration. For new post-migration users, generated
--                           via gen_random_uuid(). All foreign keys point here.
--   app_users.cognito_sub — Cognito user pool "sub" claim. This is an opaque TEXT
--                           string. Do NOT assume it is a UUID. Used for JWT→user lookup.
--
-- Fields that remain in Cognito only (NOT stored here):
--   password hash, email verification, MFA config, account status
CREATE TABLE public.app_users (
    id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cognito_sub TEXT UNIQUE,                               -- Cognito "sub" claim (opaque string)
    email       TEXT NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Case-insensitive unique index on email to prevent duplicate accounts
-- due to casing differences (e.g., User@Example.com vs user@example.com)
CREATE UNIQUE INDEX idx_app_users_email ON public.app_users (LOWER(email));

CREATE TRIGGER update_app_users_updated_at
    BEFORE UPDATE ON public.app_users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- profiles: Extended user profile data (public-facing)
-- EVIDENCE: No explicit CREATE TABLE in Supabase migrations.
--   Inferred from types.ts (15 columns) and handle_new_user() trigger (4 columns).
--   Actively queried by AdminDashboard.tsx and InterviewerDashboard.tsx.
--   REQUIRES PRODUCTION VERIFICATION before migration.
CREATE TABLE public.profiles (
    id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    email        TEXT,
    name         TEXT,
    phone        TEXT,
    title        TEXT,
    bio          TEXT,
    location     TEXT,
    skills       TEXT[],
    experience   TEXT,
    availability TEXT,
    avatar_url   TEXT,
    hourly_rate  NUMERIC(10,2),
    website      TEXT,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_profiles_user_id ON public.profiles (user_id);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- user_roles: Role assignments (RBAC)
--
-- SECURITY: Role assignment rules (enforced at Express backend, NOT at DB level):
--   Public signup → ONLY 'interviewee' or 'interviewer' allowed
--   'admin' → NEVER self-assignable via public signup
--   'admin' → assigned ONLY by an existing admin via admin endpoint
--   Backend must validate: requested roles ∩ {'interviewer','interviewee'} on signup
CREATE TABLE public.user_roles (
    id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    role       app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- =============================================================================
-- UTILITY FUNCTIONS (that reference user_roles — must be AFTER table creation)
-- =============================================================================

-- Check if a user has a specific role
-- Note: SECURITY DEFINER with explicit search_path to prevent search_path hijacking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Get all roles for a user
-- Note: SECURITY DEFINER with explicit search_path to prevent search_path hijacking
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- =============================================================================
-- BUSINESS TABLES
-- =============================================================================

-- job_postings: Recruiter-created job listings
-- EVIDENCE: CONFIRMED FROM MIGRATIONS (migration 1 + 13)
CREATE TABLE public.job_postings (
    id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    company_name    TEXT,
    description     TEXT,
    requirements    TEXT,
    location        TEXT,
    salary_range    TEXT,
    employment_type TEXT,
    status          TEXT DEFAULT 'active',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_job_postings_updated_at
    BEFORE UPDATE ON public.job_postings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- interview_sessions: Scheduled/completed interview records
-- EVIDENCE: CONFIRMED FROM MIGRATIONS (migration 1)
CREATE TABLE public.interview_sessions (
    id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_posting_id  UUID REFERENCES public.job_postings(id) ON DELETE CASCADE,
    candidate_id    UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    recruiter_id    UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    status          TEXT DEFAULT 'scheduled',
    scheduled_at    TIMESTAMP WITH TIME ZONE,
    started_at      TIMESTAMP WITH TIME ZONE,
    completed_at    TIMESTAMP WITH TIME ZONE,
    audio_url       TEXT,
    transcript      TEXT,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_interview_sessions_updated_at
    BEFORE UPDATE ON public.interview_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- cv_data: Raw CV extraction data
-- EVIDENCE: CONFIRMED FROM MIGRATIONS (migration 1)
CREATE TABLE public.cv_data (
    id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    full_name      TEXT,
    email          TEXT,
    phone          TEXT,
    location       TEXT,
    summary        TEXT,
    skills         TEXT[],
    experience     JSONB,
    education      JSONB,
    certifications JSONB,
    languages      TEXT[],
    extracted_at   TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_cv_data_updated_at
    BEFORE UPDATE ON public.cv_data
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- interview_questions: Per-session interview questions
-- EVIDENCE: CONFIRMED FROM MIGRATIONS (migration 1)
CREATE TABLE public.interview_questions (
    id                    UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_session_id  UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    question_text         TEXT NOT NULL,
    question_type         TEXT DEFAULT 'general',
    order_index           INTEGER,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- interview_responses: Candidate responses with AI analysis
-- EVIDENCE: CONFIRMED FROM MIGRATIONS (migration 1)
CREATE TABLE public.interview_responses (
    id                    UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_session_id  UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    question_id           UUID REFERENCES public.interview_questions(id) ON DELETE CASCADE,
    response_text         TEXT,
    response_audio_url    TEXT,
    transcript            TEXT,
    duration_seconds      INTEGER,
    ai_analysis           JSONB,
    score                 INTEGER,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- interview_analysis: Overall interview scoring
-- EVIDENCE: CONFIRMED FROM MIGRATIONS (migration 1)
CREATE TABLE public.interview_analysis (
    id                    UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_session_id  UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    overall_score         INTEGER,
    technical_score       INTEGER,
    communication_score   INTEGER,
    cultural_fit_score    INTEGER,
    strengths             TEXT[],
    weaknesses            TEXT[],
    recommendations       TEXT,
    ai_summary            TEXT,
    final_decision        TEXT,
    notes                 TEXT,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_interview_analysis_updated_at
    BEFORE UPDATE ON public.interview_analysis
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- cv_analysis_results: Parsed candidate profiles (from AI)
-- EVIDENCE: CONFIRMED FROM MIGRATIONS (migration 4)
CREATE TABLE public.cv_analysis_results (
    id                 UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id            UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
    file_name          TEXT NOT NULL,
    file_size          INTEGER,
    candidate_profile  JSONB NOT NULL,
    processed_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_cv_analysis_results_updated_at
    BEFORE UPDATE ON public.cv_analysis_results
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- gap_analysis_results: CV-to-JD gap analysis
-- EVIDENCE: CONFIRMED FROM MIGRATIONS (migration 4 + 10 adds job_posting_id)
CREATE TABLE public.gap_analysis_results (
    id                    UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id               UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
    cv_analysis_id        UUID REFERENCES public.cv_analysis_results(id) ON DELETE CASCADE,
    job_posting_id        UUID REFERENCES public.job_postings(id) ON DELETE SET NULL,
    job_profile           JSONB NOT NULL,
    gap_analysis          JSONB,
    robust_gap_analysis   JSONB,
    job_description       TEXT NOT NULL,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_gap_analysis_job_posting ON public.gap_analysis_results (job_posting_id);

CREATE TRIGGER update_gap_analysis_results_updated_at
    BEFORE UPDATE ON public.gap_analysis_results
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- admin_statistics: Platform-wide metrics
-- EVIDENCE: CONFIRMED FROM MIGRATIONS (migration 5)
-- Note: Original Supabase migration did NOT have an updated_at trigger. Added here.
CREATE TABLE public.admin_statistics (
    id                       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    date                     DATE NOT NULL DEFAULT CURRENT_DATE,
    total_interviews         INTEGER DEFAULT 0,
    total_cv_analyses        INTEGER DEFAULT 0,
    total_gap_analyses       INTEGER DEFAULT 0,
    ai_api_calls             INTEGER DEFAULT 0,
    estimated_cost_usd       DECIMAL(10, 2) DEFAULT 0,
    processing_time_seconds  INTEGER DEFAULT 0,
    created_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_admin_statistics_updated_at
    BEFORE UPDATE ON public.admin_statistics
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- maya_interviews: AI interviewer (Maya) session records
-- EVIDENCE: CONFIRMED FROM MIGRATIONS (migration 11 + 12)
CREATE TABLE public.maya_interviews (
    id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id        TEXT NOT NULL UNIQUE,
    user_email        TEXT,
    candidate_name    TEXT,
    candidate_phone   TEXT,
    started_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ended_at          TIMESTAMP WITH TIME ZONE,
    duration_seconds  INTEGER,
    questions         JSONB NOT NULL DEFAULT '[]'::jsonb,
    responses         JSONB NOT NULL DEFAULT '[]'::jsonb,
    transcript        JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_maya_interviews_candidate_phone ON public.maya_interviews (candidate_phone);

CREATE TRIGGER update_maya_interviews_updated_at
    BEFORE UPDATE ON public.maya_interviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- applications: Job applications
-- EVIDENCE: No CREATE TABLE in migrations. CONFIRMED FROM APPLICATION CODE
--   (BrowseJobs.tsx inserts into this table). INFERRED FROM TYPES (types.ts).
--   REQUIRES PRODUCTION VERIFICATION for actual column set.
--
-- KNOWN NAMING INCONSISTENCY: The column 'opportunity_id' references
--   job_postings.id, not an 'opportunities' table. The application code
--   (BrowseJobs.tsx L74) passes selectedJob.id (a job_postings UUID) as
--   opportunity_id. This naming is preserved for migration compatibility.
--   Do NOT rename during this migration.
CREATE TABLE public.applications (
    id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    opportunity_id  UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
    applicant_id    UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    cover_letter    TEXT,
    status          TEXT DEFAULT 'pending',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- CANDIDATE-FOR-REMOVAL TABLES
-- =============================================================================
-- The following tables appear in Supabase-generated types.ts but have:
--   - No CREATE TABLE migration
--   - No application code that queries them (except types definition)
-- They likely exist in the Supabase database via dashboard creation.
-- They are included here to preserve data during migration but are
-- marked as candidates for removal after production verification.

-- CANDIDATE FOR REMOVAL: opportunities
-- EVIDENCE: INFERRED FROM TYPES only. No migration. No application code queries it.
-- Note: BrowseJobs.tsx references opportunity_id on applications table,
--       but queries job_postings — not opportunities. The applications table
--       uses job_postings.id as the "opportunity" in practice.
CREATE TABLE public.opportunities (
    id                 UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id            UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    title              TEXT NOT NULL,
    company_name       TEXT,
    description        TEXT,
    requirements       TEXT,
    location           TEXT,
    duration           TEXT,
    employment_type    TEXT,
    experience_level   TEXT,
    budget_min         NUMERIC(10,2),
    budget_max         NUMERIC(10,2),
    skills             TEXT[],
    remote_allowed     BOOLEAN,
    is_urgent          BOOLEAN,
    applications_count INTEGER DEFAULT 0,
    status             TEXT DEFAULT 'active',
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CANDIDATE FOR REMOVAL: projects
-- EVIDENCE: INFERRED FROM TYPES only. No migration. No application code queries it.
CREATE TABLE public.projects (
    id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id          UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    description      TEXT,
    company_name     TEXT,
    image_url        TEXT,
    github_url       TEXT,
    live_url         TEXT,
    technologies     TEXT[],
    duration         TEXT,
    team_size        TEXT,
    budget           NUMERIC(10,2),
    industry         TEXT,
    experience_level TEXT,
    requirements     TEXT,
    is_urgent        BOOLEAN,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CANDIDATE FOR REMOVAL: referrals
-- EVIDENCE: INFERRED FROM TYPES only. No migration. No application code queries it.
CREATE TABLE public.referrals (
    id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    referee_name    TEXT NOT NULL,
    referee_email   TEXT NOT NULL,
    referee_company TEXT,
    referral_type   TEXT NOT NULL,
    message         TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CANDIDATE FOR REMOVAL: transactions
-- EVIDENCE: INFERRED FROM TYPES only. No migration. No application code queries it.
CREATE TABLE public.transactions (
    id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    amount      NUMERIC(10,2) NOT NULL,
    description TEXT NOT NULL,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CANDIDATE FOR REMOVAL: work_experiences
-- EVIDENCE: INFERRED FROM TYPES only. No migration. No application code queries it.
CREATE TABLE public.work_experiences (
    id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    company     TEXT NOT NULL,
    position    TEXT NOT NULL,
    description TEXT,
    duration    TEXT,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
-- Total objects created:
--   1  extension    (pgcrypto)
--   1  enum type    (app_role)
--   3  functions    (update_updated_at_column, has_role, get_user_roles)
--  19  tables       (3 identity + 10 business + 1 applications + 5 candidate-for-removal)
--   4  indexes      (app_users LOWER(email), profiles user_id, gap_analysis job_posting, maya_interviews phone)
--  11  triggers     (updated_at auto-update on all active tables with updated_at column)
--   0  RLS policies (authorization handled at Express middleware layer)
-- =============================================================================
