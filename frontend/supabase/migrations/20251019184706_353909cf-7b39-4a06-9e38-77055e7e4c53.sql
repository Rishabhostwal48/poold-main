-- Add candidate details to maya_interviews table
ALTER TABLE public.maya_interviews 
ADD COLUMN IF NOT EXISTS candidate_name text,
ADD COLUMN IF NOT EXISTS candidate_phone text;

-- Add index for querying by phone
CREATE INDEX IF NOT EXISTS idx_maya_interviews_candidate_phone 
ON public.maya_interviews(candidate_phone);
