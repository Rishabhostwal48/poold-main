/**
 * Zustand store for interview state management
 * Handles candidate profiles, transcripts, evidence, and session persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { 
  CandidateProfile, 
  JobProfile, 
  GapAnalysis, 
  InterviewStage, 
  TranscriptItem, 
  Evidence,
  InterviewSession,
  AppSettings
} from '../types';
import type { RobustGapAnalysis } from '@/lib/gap';

interface InterviewStore {
  // Current session data
  sessionId: string | null;
  candidate: CandidateProfile | null;
  job: JobProfile | null;
  gap: GapAnalysis | null;
  robustGap: RobustGapAnalysis | null;
  stage: InterviewStage;
  transcript: TranscriptItem[];
  evidence: Record<string, Evidence[]>; // requirement -> evidence list
  notes: string;
  isCompleted: boolean;
  generatedQuestions: any[]; // Dynamic questions based on CV & JD
  
  // App settings
  settings: AppSettings;
  
  // Actions
  setCandidate: (profile: CandidateProfile) => void;
  setJob: (profile: JobProfile) => void;
  setGap: (analysis: GapAnalysis) => void;
  setRobustGap: (analysis: RobustGapAnalysis) => void;
  setStage: (stage: InterviewStage) => void;
  addTranscript: (item: TranscriptItem) => void;
  addEvidence: (requirement: string, evidence: Evidence) => void;
  removeEvidence: (requirement: string, timestamp: string) => void;
  updateNotes: (notes: string) => void;
  setGeneratedQuestions: (questions: any[]) => void;
  startNewSession: () => void;
  completeSession: () => void;
  loadSession: (session: InterviewSession) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  reset: () => void;
  
  // Computed values
  getCoveragePercent: () => number;
  getEvidenceCount: () => number;
  canProceedToInterview: () => boolean;
}

const initialState = {
  sessionId: null,
  candidate: null,
  job: null,
  gap: null,
  robustGap: null,
  stage: "intro" as InterviewStage,
  transcript: [],
  evidence: {},
  notes: "",
  isCompleted: false,
  generatedQuestions: [],
  settings: {
    audioInputDevice: undefined,
    audioOutputDevice: undefined,
    autoSave: true,
    theme: "light" as const,
  },
};

export const useInterviewStore = create<InterviewStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setCandidate: (profile) => set({ candidate: profile }),
      
      setJob: (profile) => set({ job: profile }),
      
      setGap: (analysis) => set({ gap: analysis }),
      
      setRobustGap: (analysis) => set({ robustGap: analysis }),
      
      setStage: (stage) => set({ stage }),
      
      addTranscript: (item) => 
        set((state) => ({
          transcript: [...state.transcript, item]
        })),
      
      addEvidence: (requirement, evidence) =>
        set((state) => ({
          evidence: {
            ...state.evidence,
            [requirement]: [...(state.evidence[requirement] || []), evidence]
          }
        })),
      
      removeEvidence: (requirement, timestamp) =>
        set((state) => ({
          evidence: {
            ...state.evidence,
            [requirement]: (state.evidence[requirement] || []).filter(
              (ev) => ev.timestamp !== timestamp
            )
          }
        })),
      
      updateNotes: (notes) => set({ notes }),
      
      setGeneratedQuestions: (questions) => set({ generatedQuestions: questions }),
      
      startNewSession: () => {
        const sessionId = `session_${Date.now()}`;
        set({
          ...initialState,
          sessionId,
          settings: get().settings, // preserve settings
        });
      },
      
      completeSession: () => set({ isCompleted: true }),
      
      loadSession: (session) =>
        set({
          sessionId: session.id,
          candidate: session.candidate || null,
          job: session.job || null,
          gap: session.gap || null,
          robustGap: null, // Recompute robust gap analysis
          stage: session.stage,
          transcript: session.transcript,
          evidence: session.evidence,
          notes: session.notes,
          isCompleted: session.completed,
        }),
      
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        })),
      
      reset: () => 
        set({
          ...initialState,
          settings: get().settings, // preserve settings
        }),
      
      // Computed values
      getCoveragePercent: () => {
        const state = get();
        if (!state.job?.must_haves?.length) return 0;
        
        const coveredCount = state.job.must_haves.filter(
          (req) => (state.evidence[req]?.length || 0) >= 1
        ).length;
        
        return Math.round((coveredCount / state.job.must_haves.length) * 100);
      },
      
      getEvidenceCount: () => {
        const state = get();
        return Object.values(state.evidence).reduce(
          (total, evidenceList) => total + evidenceList.length,
          0
        );
      },
      
      canProceedToInterview: () => {
        const state = get();
        return !!(state.candidate && state.job);
      },
    }),
    {
      name: 'vocal-recruiter-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        candidate: state.candidate,
        job: state.job,
        gap: state.gap,
        robustGap: state.robustGap,
        stage: state.stage,
        transcript: state.transcript,
        evidence: state.evidence,
        notes: state.notes,
        isCompleted: state.isCompleted,
        settings: state.settings,
      }),
    }
  )
);