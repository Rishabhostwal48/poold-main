-- Add job_posting_id to gap_analysis_results to link gap analyses to job postings
ALTER TABLE gap_analysis_results 
ADD COLUMN job_posting_id uuid REFERENCES job_postings(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_gap_analysis_job_posting ON gap_analysis_results(job_posting_id);

-- Drop the old recruiter policy
DROP POLICY IF EXISTS "Recruiters can view gap analyses for their candidates" ON gap_analysis_results;

-- Create new policy that allows recruiters to see gap analyses for:
-- 1. Candidates in their interview sessions
-- 2. Candidates who created gap analyses for their job postings
CREATE POLICY "Recruiters can view gap analyses for their job postings and candidates"
ON gap_analysis_results
FOR SELECT
USING (
  (auth.uid() = user_id) OR
  (EXISTS (
    SELECT 1 FROM interview_sessions
    WHERE interview_sessions.candidate_id = gap_analysis_results.user_id
      AND interview_sessions.recruiter_id = auth.uid()
  )) OR
  (EXISTS (
    SELECT 1 FROM job_postings
    WHERE job_postings.id = gap_analysis_results.job_posting_id
      AND job_postings.user_id = auth.uid()
  ))
);