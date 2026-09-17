/**
 * AI Services for OpenAI and Whisper integration
 * Provides interfaces to OpenAI GPT models and Whisper for speech-to-text
 */

import { supabase } from '@/integrations/supabase/client';

export interface OpenAIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface WhisperTranscription {
  text: string;
  confidence?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

/**
 * Transcribe audio using OpenAI Whisper
 * @param audioBlob - Audio blob to transcribe
 * @param language - Optional language code (e.g., 'en', 'es')
 */
export async function transcribeAudio(
  audioBlob: Blob, 
  language?: string
): Promise<{ success: boolean; data?: WhisperTranscription; error?: string }> {
  try {
    // TODO: Replace with actual OpenAI Whisper API call via Supabase Edge Function
    console.log('🎤 [PLACEHOLDER] Transcribing audio with Whisper:', {
      size: audioBlob.size,
      type: audioBlob.type,
      language
    });

    let data, error;
await fetch(`${import.meta.env.VITE_BACKEND_URL}/transcribe-audio`,{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Convert blob to base64 for transmission
        audio: await blobToBase64(audioBlob),
        language: language || 'en',
        model: 'whisper-1'
      })
    }).then(res => res.json()).then(resData => {
      data = resData;
    }).catch(err => {
      error = err;
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data.transcription };
  } catch (error) {
    console.error('Transcription error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Transcription failed' 
    };
  }
}

/**
 * Generate interview questions using OpenAI GPT
 * @param jobDescription - Job description text
 * @param candidateProfile - Candidate CV data
 * @param difficulty - Question difficulty level
 */
export async function generateInterviewQuestions(
  jobDescription: string,
  candidateProfile: any,
  difficulty: 'junior' | 'mid' | 'senior' = 'mid'
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    console.log('🤖 [PLACEHOLDER] Generating interview questions with OpenAI:', {
      difficulty,
      jobDescriptionLength: jobDescription.length
    });
    let data, error;
 await fetch(`${import.meta.env.VITE_BACKEND_URL}/generate-questions`,{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
       body: JSON.stringify({
        jobDescription,
        candidateProfile,
        difficulty,
        model: 'gpt-4o-mini' // Cost-effective for question generation
      })
    }).then(res => res.json()).then(resData => {
      data = resData;
    }).catch(err => {
      error = err;
    });
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data.questions };
  } catch (error) {
    console.error('Question generation error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Question generation failed' 
    };
  }
}

/**
 * Analyze interview response using OpenAI
 * @param question - Interview question
 * @param response - Candidate's response
 * @param context - Additional context (job requirements, etc.)
 */
export async function analyzeResponse(
  question: string,
  response: string,
  context: any
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log('🧠 [PLACEHOLDER] Analyzing response with OpenAI:', {
      questionLength: question.length,
      responseLength: response.length
    });

    // const { data, error } = await supabase.functions.invoke('analyze-response', {
    //   body: {
    //     question,
    //     response,
    //     context,
    //     model: 'gpt-4o' // Using more powerful model for analysis
    //   }
    // });
    let data, error;
 await fetch(`${import.meta.env.VITE_BACKEND_URL}/analyze-response`,{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
       body: JSON.stringify({
        question,
        response,
        context,
        model: 'gpt-4o' // Using more powerful model for analysis
      })
       
       }).then(res => res.json()).then(resData => {
        data = resData;
     }).catch(err => {
        error = err;
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data.analysis };
  } catch (error) {
    console.error('Response analysis error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Response analysis failed' 
    };
  }
}

/**
 * Generate final interview summary and scoring
 * @param interviewData - Complete interview session data
 */
export async function generateInterviewSummary(interviewData: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log('🔄 Generating interview summary...', {
      candidateName: interviewData.candidate?.basics?.name,
      jobTitle: interviewData.job?.title,
      transcriptLength: interviewData.transcript?.length,
      evidenceKeys: Object.keys(interviewData.evidence || {}).length
    });

    // const { data, error } = await supabase.functions.invoke('generate-summary', {
    //   body: {
    //     interviewData,
    //     model: 'gpt-5-2025-08-07' // Use latest model
    //   }
    // });

    let data, error;

await fetch(`${import.meta.env.VITE_BACKEND_URL}/generate-summary`,{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
       body: JSON.stringify({
        interviewData,
        model: 'gpt-5-2025-08-07' // Use latest model
      })
    }).then(res => res.json()).then(resData => {
      data = resData;
    }).catch(err => {
      error = err;
    });

    if (error) {
      console.error('❌ Summary generation error:', error);
      return { success: false, error: error.message };
    }

    if (data.summary) {
      console.log('✅ Summary generated successfully:', {
        overallScore: data.summary.overallScore,
        recommendation: data.summary.recommendation
      });
      return { success: true, data: data.summary };
    } else {
      console.error('❌ No summary data in response:', data);
      return { success: false, error: data.error || 'No summary data received' };
    }
  } catch (error: any) {
    console.error('❌ Summary generation error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to generate interview summary' 
    };
  }
}

/**
 * Parse CV content using OpenAI
 * @param cvText - Extracted CV text content
 */
export async function parseCVContent(
  cvText: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log('📄 [PLACEHOLDER] Parsing CV with OpenAI:', {
      textLength: cvText.length
    });

    // const { data, error } = await supabase.functions.invoke('parse-cv-content', {
    //   body: {
    //     cvText,
    //     model: 'gpt-4o-mini' // Cost-effective for structured parsing
    //   }
    // });
    let data, error;
 
await fetch(`${import.meta.env.VITE_BACKEND_URL}/parse-cv-content`,{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
        body: JSON.stringify({
        cvText,
        model: 'gpt-4o-mini' // Cost-effective for structured parsing
      })
    }).then(res => res.json()).then(resData => {
      data = resData;
    }).catch(err => {
      error = err;
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data.parsedCV };
  } catch (error) {
    console.error('CV parsing error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'CV parsing failed' 
    };
  }
}

// Utility functions
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data:audio/xxx;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Mock responses for development (remove when API is connected)
export const mockResponses = {
  transcription: {
    text: "I have been working as a software engineer for the past five years, primarily focusing on React and Node.js development. In my previous role, I led a team of four developers and successfully delivered three major projects on time.",
    confidence: 0.95,
    segments: [
      { start: 0, end: 3.2, text: "I have been working as a software engineer" },
      { start: 3.2, end: 6.8, text: "for the past five years, primarily focusing" },
      { start: 6.8, end: 10.1, text: "on React and Node.js development." }
    ]
  },
  interviewQuestions: [
    {
      id: "q1",
      question: "Can you describe a challenging project you worked on and how you overcame the obstacles?",
      type: "behavioral",
      category: "problem-solving",
      expectedDuration: 300
    },
    {
      id: "q2", 
      question: "How would you implement a real-time messaging system using React and Node.js?",
      type: "technical",
      category: "system-design",
      expectedDuration: 600
    }
  ]
};