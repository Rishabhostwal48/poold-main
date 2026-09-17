-- Create table for storing CV analysis results
CREATE TABLE public.cv_analysis_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  candidate_profile JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for storing gap analysis results
CREATE TABLE public.gap_analysis_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cv_analysis_id UUID REFERENCES public.cv_analysis_results(id) ON DELETE CASCADE,
  job_profile JSONB NOT NULL,
  gap_analysis JSONB,
  robust_gap_analysis JSONB,
  job_description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cv_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gap_analysis_results ENABLE ROW LEVEL SECURITY;

-- Create policies for CV analysis results
CREATE POLICY "Users can view their own CV analysis results" 
ON public.cv_analysis_results 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own CV analysis results" 
ON public.cv_analysis_results 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own CV analysis results" 
ON public.cv_analysis_results 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own CV analysis results" 
ON public.cv_analysis_results 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for gap analysis results
CREATE POLICY "Users can view their own gap analysis results" 
ON public.gap_analysis_results 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own gap analysis results" 
ON public.gap_analysis_results 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gap analysis results" 
ON public.gap_analysis_results 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own gap analysis results" 
ON public.gap_analysis_results 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_cv_analysis_results_updated_at
BEFORE UPDATE ON public.cv_analysis_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gap_analysis_results_updated_at
BEFORE UPDATE ON public.gap_analysis_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();