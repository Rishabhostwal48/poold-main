import { supabase } from '@/integrations/supabase/client';
import type { CandidateProfile, JobProfile, GapAnalysis } from '@/types';

export interface CVAnalysisInput {
  file_name: string;
  file_size?: number;
  candidate_profile: CandidateProfile;
}

export interface GapAnalysisInput {
  cv_analysis_id: string;
  job_profile: JobProfile;
  gap_analysis?: GapAnalysis;
  robust_gap_analysis?: any;
  job_description: string;
  job_posting_id?: string;
}

export async function saveCVAnalysis(data: CVAnalysisInput) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn('No authenticated user, skipping CV analysis save');
      return null;
    }

    const { data: result, error } = await supabase
      .from('cv_analysis_results')
      .insert({
        file_name: data.file_name,
        file_size: data.file_size,
        candidate_profile: data.candidate_profile as any,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving CV analysis:', error);
      return null;
    }

    return result;
  } catch (error) {
    console.error('Error saving CV analysis:', error);
    return null;
  }
}

export async function saveGapAnalysis(data: GapAnalysisInput) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn('No authenticated user, skipping gap analysis save');
      return null;
    }

    const { data: result, error } = await supabase
      .from('gap_analysis_results')
      .insert({
        cv_analysis_id: data.cv_analysis_id,
        job_profile: data.job_profile as any,
        gap_analysis: data.gap_analysis as any,
        robust_gap_analysis: data.robust_gap_analysis as any,
        job_description: data.job_description,
        job_posting_id: data.job_posting_id,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving gap analysis:', error);
      return null;
    }

    return result;
  } catch (error) {
    console.error('Error saving gap analysis:', error);
    return null;
  }
}

export async function getCVAnalysisResults() {
  try {
    const { data, error } = await supabase
      .from('cv_analysis_results')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching CV analysis results:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching CV analysis results:', error);
    return [];
  }
}

export async function getGapAnalysisResults() {
  try {
    const { data, error } = await supabase
      .from('gap_analysis_results')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching gap analysis results:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching gap analysis results:', error);
    return [];
  }
}