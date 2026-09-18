-- Reconcile the deployed database with the job-posting schema used by the app.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.job_postings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    company_name TEXT,
    description TEXT,
    requirements TEXT,
    location TEXT,
    salary_range TEXT,
    employment_type TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_postings'
      AND policyname = 'Users can view active job postings'
  ) THEN
    CREATE POLICY "Users can view active job postings" ON public.job_postings
      FOR SELECT USING (status = 'active');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_postings'
      AND policyname = 'Recruiters can manage their job postings'
  ) THEN
    CREATE POLICY "Recruiters can manage their job postings" ON public.job_postings
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;