-- Create tables for vocal recruiting application

-- Job postings table
CREATE TABLE public.job_postings (
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

-- Interview sessions table
CREATE TABLE public.interview_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_posting_id UUID REFERENCES public.job_postings(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL,
    recruiter_id UUID NOT NULL,
    status TEXT DEFAULT 'scheduled',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    audio_url TEXT,
    transcript TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CV data table
CREATE TABLE public.cv_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    location TEXT,
    summary TEXT,
    skills TEXT[],
    experience JSONB,
    education JSONB,
    certifications JSONB,
    languages TEXT[],
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Interview questions table
CREATE TABLE public.interview_questions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'general',
    order_index INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Interview responses table
CREATE TABLE public.interview_responses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.interview_questions(id) ON DELETE CASCADE,
    response_text TEXT,
    response_audio_url TEXT,
    transcript TEXT,
    duration_seconds INTEGER,
    ai_analysis JSONB,
    score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Interview analysis table
CREATE TABLE public.interview_analysis (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    overall_score INTEGER,
    technical_score INTEGER,
    communication_score INTEGER,
    cultural_fit_score INTEGER,
    strengths TEXT[],
    weaknesses TEXT[],
    recommendations TEXT,
    ai_summary TEXT,
    final_decision TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_postings
CREATE POLICY "Users can view active job postings" ON public.job_postings
FOR SELECT USING (status = 'active');

CREATE POLICY "Recruiters can manage their job postings" ON public.job_postings
FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for interview_sessions
CREATE POLICY "Users can view their interview sessions" ON public.interview_sessions
FOR SELECT USING (auth.uid() = candidate_id OR auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can manage interview sessions" ON public.interview_sessions
FOR ALL USING (auth.uid() = recruiter_id);

-- RLS Policies for cv_data
CREATE POLICY "Users can manage their own CV data" ON public.cv_data
FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for interview_questions
CREATE POLICY "Users can view questions for their interviews" ON public.interview_questions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.interview_sessions 
        WHERE id = interview_questions.interview_session_id 
        AND (candidate_id = auth.uid() OR recruiter_id = auth.uid())
    )
);

CREATE POLICY "Recruiters can manage questions for their interviews" ON public.interview_questions
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.interview_sessions 
        WHERE id = interview_questions.interview_session_id 
        AND recruiter_id = auth.uid()
    )
);

-- RLS Policies for interview_responses
CREATE POLICY "Users can view responses for their interviews" ON public.interview_responses
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.interview_sessions 
        WHERE id = interview_responses.interview_session_id 
        AND (candidate_id = auth.uid() OR recruiter_id = auth.uid())
    )
);

CREATE POLICY "Users can create responses for their interviews" ON public.interview_responses
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.interview_sessions 
        WHERE id = interview_responses.interview_session_id 
        AND candidate_id = auth.uid()
    )
);

CREATE POLICY "Recruiters can manage responses for their interviews" ON public.interview_responses
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.interview_sessions 
        WHERE id = interview_responses.interview_session_id 
        AND recruiter_id = auth.uid()
    )
);

-- RLS Policies for interview_analysis
CREATE POLICY "Users can view analysis for their interviews" ON public.interview_analysis
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.interview_sessions 
        WHERE id = interview_analysis.interview_session_id 
        AND (candidate_id = auth.uid() OR recruiter_id = auth.uid())
    )
);

CREATE POLICY "Recruiters can manage analysis for their interviews" ON public.interview_analysis
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.interview_sessions 
        WHERE id = interview_analysis.interview_session_id 
        AND recruiter_id = auth.uid()
    )
);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_job_postings_updated_at
    BEFORE UPDATE ON public.job_postings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interview_sessions_updated_at
    BEFORE UPDATE ON public.interview_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cv_data_updated_at
    BEFORE UPDATE ON public.cv_data
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interview_analysis_updated_at
    BEFORE UPDATE ON public.interview_analysis
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();