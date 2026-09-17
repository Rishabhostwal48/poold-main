-- Fix RLS policy for interview_sessions to allow candidates to create sessions
-- Drop the existing ALL policy for recruiters and create separate policies
DROP POLICY IF EXISTS "Recruiters can manage interview sessions" ON public.interview_sessions;

-- Recruiters can SELECT their interview sessions
CREATE POLICY "Recruiters can view their interview sessions"
ON public.interview_sessions
FOR SELECT
USING (auth.uid() = recruiter_id);

-- Recruiters can UPDATE and DELETE their interview sessions
CREATE POLICY "Recruiters can update their interview sessions"
ON public.interview_sessions
FOR UPDATE
USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can delete their interview sessions"
ON public.interview_sessions
FOR DELETE
USING (auth.uid() = recruiter_id);

-- Candidates can INSERT interview sessions where they are the candidate
CREATE POLICY "Candidates can create interview sessions"
ON public.interview_sessions
FOR INSERT
WITH CHECK (auth.uid() = candidate_id);

-- Fix RLS policy for gap_analysis_results to allow recruiters to view analyses for their candidates
-- Recruiters can view gap analyses for candidates who have interview sessions with them
CREATE POLICY "Recruiters can view gap analyses for their candidates"
ON public.gap_analysis_results
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.interview_sessions
    WHERE interview_sessions.candidate_id = gap_analysis_results.user_id
      AND interview_sessions.recruiter_id = auth.uid()
  )
  OR auth.uid() = user_id
);