import { backendApi } from './backendApi';
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
    const res = await backendApi.saveCvAnalysis({
      file_name: data.file_name,
      file_size: data.file_size,
      candidate_profile: data.candidate_profile,
    });
    return res.data;
  } catch (error) {
    console.error('Error saving CV analysis:', error);
    return null;
  }
}

export async function saveGapAnalysis(data: GapAnalysisInput) {
  try {
    const res = await backendApi.saveGapAnalysis({
      cv_analysis_id: data.cv_analysis_id,
      job_profile: data.job_profile,
      gap_analysis: data.gap_analysis,
      robust_gap_analysis: data.robust_gap_analysis,
      job_description: data.job_description,
      job_posting_id: data.job_posting_id,
    });
    return res.data;
  } catch (error) {
    console.error('Error saving gap analysis:', error);
    return null;
  }
}

export async function getCVAnalysisResults() {
  try {
    const res = await backendApi.getCvAnalyses();
    return res.data || [];
  } catch (error) {
    console.error('Error fetching CV analysis results:', error);
    return [];
  }
}

export async function getGapAnalysisResults() {
  try {
    const res = await backendApi.getGapAnalyses();
    return res.data || [];
  } catch (error) {
    console.error('Error fetching gap analysis results:', error);
    return [];
  }
}