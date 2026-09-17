-- Create maya_interviews table to store Maya interview sessions
CREATE TABLE public.maya_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_email TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  responses JSONB NOT NULL DEFAULT '[]'::jsonb,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maya_interviews ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for unauthenticated interviews)
CREATE POLICY "Anyone can create maya interviews"
ON public.maya_interviews
FOR INSERT
WITH CHECK (true);

-- Users can view their own interviews (by email if provided)
CREATE POLICY "Users can view their own interviews"
ON public.maya_interviews
FOR SELECT
USING (user_email = current_setting('request.jwt.claims', true)::json->>'email' OR user_email IS NULL);

-- Add updated_at trigger
CREATE TRIGGER update_maya_interviews_updated_at
BEFORE UPDATE ON public.maya_interviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();