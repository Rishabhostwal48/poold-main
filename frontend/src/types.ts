/**
 * TypeScript types for Vocal Recruiter application
 * Defines all data structures for CV analysis, interviews, and scoring
 */

export type InterviewStage = "intro" | "background" | "competency" | "deep_dive" | "behavioral" | "closing";

export type CoverageStatus = "covered" | "unknown";

export type FitLevel = "Strong" | "Moderate" | "Weak";

export type Speaker = "interviewer" | "candidate";

// STAR method for behavioral interview responses
export interface Star {
  type: "STAR";
  situation: string;
  task: string;
  action: string;
  result: string;
  metrics: string[];
  evidence_source: "CV" | "Interview" | "JD";
}

// Professional work experience
export interface Role {
  title: string;
  company: string;
  start: string;
  end: string;
  achievements: string[];
  tools: string[];
  domains: string[];
}

// Candidate profile extracted from CV
export interface CandidateProfile {
  basics: {
    name: string;
    location?: string;
    years_experience?: number;
    education: string[];
  };
  roles: Role[];
  skills: Record<string, string[]>; // skill category -> specific skills
  certs: string[];
  highlights: Star[];
}

// Job requirements and competencies
export interface JobProfile {
  title: string;
  level?: string;
  must_haves: string[];
  nice_haves: string[];
  responsibilities: string[];
  competencies: {
    name: string;
    signals: string[]; // what to look for in responses
  }[];
}

// Gap analysis between candidate and job requirements
export interface GapAnalysis {
  coverage: Record<string, CoverageStatus>;
  open: string[]; // requirements with no evidence
}

// Real-time transcript during interview
export interface TranscriptItem {
  id: string;
  ts: string; // timestamp
  speaker: Speaker;
  text: string;
}

// Evidence collected during interview
export interface Evidence {
  quote: string;
  timestamp: string;
  transcript_id?: string;
}

// Competency scoring after interview
export interface CompetencyScore {
  competency: string;
  score: number; // 1-5 scale
  evidence: string[];
  risks: string[];
}

// Final interview assessment
export interface InterviewSummary {
  overall_fit: FitLevel;
  competency_scores: CompetencyScore[];
  gaps: string[];
  follow_ups: string[];
  evidence_matrix: {
    requirement: string;
    evidence: Evidence[];
  }[];
}

// WebSocket message types
export interface InterviewQuestion {
  question: string;
  expected_signals?: string[];
  if_short_followup?: string;
}

// API response wrappers
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface CVIngestResponse extends ApiResponse<CandidateProfile> {}

export interface JDIngestResponse extends ApiResponse<{
  job_profile: JobProfile;
  gap?: GapAnalysis;
}> {}

export interface ScoreResponse extends ApiResponse<InterviewSummary> {}

// Audio recording state
export interface AudioState {
  isRecording: boolean;
  isConnected: boolean;
  currentDevice?: string;
  volume: number;
  duration: number;
}

// App-wide settings
export interface AppSettings {
  audioInputDevice?: string;
  audioOutputDevice?: string;
  autoSave: boolean;
  theme: "light" | "dark";
}

// Interview session persistence
export interface InterviewSession {
  id: string;
  created_at: string;
  candidate?: CandidateProfile;
  job?: JobProfile;
  gap?: GapAnalysis;
  stage: InterviewStage;
  transcript: TranscriptItem[];
  evidence: Record<string, Evidence[]>;
  notes: string;
  completed: boolean;
}