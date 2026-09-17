/**
 * API service layer for Vocal Recruiter
 * Handles communication with backend services and provides mock responses for development
 */

import type { 
  CVIngestResponse, 
  JDIngestResponse, 
  ScoreResponse,
  CandidateProfile,
  JobProfile,
  GapAnalysis,
  InterviewSummary
} from '../types';

// API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Mock flag for development - set to false to use real AI integration
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// Check if we can run the real processing or fall back to mocks
// In browser environment, some node modules might not work properly
const canUseRealProcessing = () => {
  try {
    // Check if we're in browser and if required modules are available
    return typeof window !== 'undefined' && 
           !USE_MOCKS && 
           // Add other runtime checks here if needed
           true;
  } catch {
    return false;
  }
};

/**
 * Upload and parse CV file
 */
export async function ingestCV(file: File): Promise<CVIngestResponse> {
  // Use real processing if available, otherwise fall back to mocks
  if (!canUseRealProcessing()) {
    console.log('📄 Using mock CV processing (set VITE_USE_MOCKS=false for real AI processing)');
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      ok: true,
      data: generateMockCandidateProfile(file.name)
    };
  }

  try {
    console.log('📄 Processing CV file with multipart upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    // Step 1: Upload the file to Supabase storage
    const { uploadCvPdf } = await import('./uploadCv');
    const uploadResult = await uploadCvPdf(file);
    console.log('✅ CV uploaded successfully:', uploadResult);

    // Step 2: Extract text from the PDF client-side
    const { extractFileText } = await import('./pdfClient');
    const cvText = await extractFileText(file);
    console.log('📄 Extracted CV text:', { textLength: cvText.length });

    // Step 3: Parse the CV content using AI
    const { parseCVContent } = await import('../services/aiServices');
    const parseResult = await parseCVContent(cvText);
    
    if (!parseResult.success) {
      throw new Error(parseResult.error || 'Failed to parse CV content');
    }

    console.log('🤖 CV parsed successfully:', parseResult.data);

    // Step 4: Transform parsed CV to our profile format
    const candidateProfile = transformParsedCVToProfile(parseResult.data);

    return {
      ok: true,
      data: candidateProfile
    };

  } catch (error) {
    console.error('CV upload error:', error);
    return {
      ok: false,
      error: `Failed to upload CV: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Removed uploadCvFile function as we're using direct edge function processing

/**
 * Parse job description text or file
 */
export async function ingestJD(content: string, file?: File): Promise<JDIngestResponse> {
  // Use real processing if available, otherwise fall back to mocks
  if (!canUseRealProcessing()) {
    console.log('📋 Using mock job description processing (set VITE_USE_MOCKS=false for real AI processing)');
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const jobProfile = generateMockJobProfile(content);
    const gapAnalysis = generateMockGapAnalysis(jobProfile);
    
    return {
      ok: true,
      data: {
        job_profile: jobProfile,
        gap: gapAnalysis
      }
    };
  }

  try {
    console.log('📋 Processing job description with AI:', {
      contentLength: content.length,
      hasFile: !!file
    });

    // Use OpenAI to analyze job description via Supabase edge function
    const { supabase } = await import('@/integrations/supabase/client');
    
    let requestBody;
    
    if (file) {
      // Convert file to base64 for processing
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      requestBody = {
        fileData: base64Data,
        fileName: file.name,
        extractRequirements: true,
        generateGapAnalysis: true
      };
    } else {
      requestBody = {
        jobDescription: content,
        extractRequirements: true,
        generateGapAnalysis: true
      };
    }
    
    // const { data, error } = await supabase.functions.invoke('analyze-job-description', {
    //   body: requestBody
    // });
let data, error;
await fetch (`${import.meta.env.VITE_BACKEND_URL}/analyze-job-desc`,{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }).then((res)=> res.json()).then((resData)=>{
      data = resData;
    }).catch((err)=>{
      error = err;
})
    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || 'Failed to analyze job description with AI');
    }

    if (!data?.jobProfile) {
      throw new Error('No job analysis data received from AI');
    }

    console.log('✅ Job description analyzed successfully:', {
      title: data.jobProfile.title,
      requirementsCount: data.jobProfile.must_haves?.length || 0
    });

    return {
      ok: true,
      data: {
        job_profile: data.jobProfile,
        gap: data.gapAnalysis || null
      }
    };

  } catch (error) {
    console.error('Job description processing error:', error);
    return {
      ok: false,
      error: `Failed to process job description: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Generate interview summary and scores
 */
export async function generateScore(
  candidateProfile: CandidateProfile,
  jobProfile: JobProfile,
  transcriptData: any
): Promise<ScoreResponse> {
  if (USE_MOCKS) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      ok: true,
      data: generateMockInterviewSummary(jobProfile)
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_profile: candidateProfile,
        job_profile: jobProfile,
        transcript_data: transcriptData,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      ok: false,
      error: `Failed to generate score: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Mock data generators
function generateMockCandidateProfile(fileName: string): CandidateProfile {
  return {
    basics: {
      name: "Sarah Chen",
      location: "San Francisco, CA",
      years_experience: 8,
      education: ["BS Computer Science - Stanford University (2016)", "MS AI - MIT (2018)"]
    },
    roles: [
      {
        title: "Senior Software Engineer",
        company: "TechCorp Inc.",
        start: "2021-03",
        end: "present",
        achievements: [
          "Led migration to microservices architecture, reducing system latency by 40%",
          "Mentored 5 junior engineers, improving team velocity by 25%",
          "Implemented real-time analytics pipeline processing 1M+ events/day"
        ],
        tools: ["React", "Node.js", "PostgreSQL", "AWS", "Docker", "Kubernetes"],
        domains: ["Web Development", "System Architecture", "Team Leadership"]
      },
      {
        title: "Software Engineer",
        company: "StartupXYZ",
        start: "2018-08",
        end: "2021-02",
        achievements: [
          "Built core product features serving 100K+ daily active users",
          "Optimized database queries, improving response times by 60%",
          "Established CI/CD pipeline reducing deployment time from hours to minutes"
        ],
        tools: ["Python", "Django", "Redis", "MySQL", "React", "TypeScript"],
        domains: ["Full Stack Development", "Database Optimization", "DevOps"]
      }
    ],
    skills: {
      "Programming Languages": ["JavaScript", "TypeScript", "Python", "Go"],
      "Frontend": ["React", "Vue.js", "HTML/CSS", "Tailwind"],
      "Backend": ["Node.js", "Django", "Express", "GraphQL"],
      "Database": ["PostgreSQL", "MySQL", "Redis", "MongoDB"],
      "Cloud & DevOps": ["AWS", "Docker", "Kubernetes", "Terraform"],
      "Soft Skills": ["Team Leadership", "Mentoring", "Technical Communication"]
    },
    certs: ["AWS Solutions Architect Associate", "Certified Kubernetes Administrator"],
    highlights: [
      {
        type: "STAR",
        situation: "System performance was degrading due to monolithic architecture",
        task: "Lead architectural redesign to improve scalability and maintainability",
        action: "Designed and implemented microservices migration strategy with team of 6 engineers",
        result: "Reduced system latency by 40% and improved deployment frequency by 300%",
        metrics: ["40% latency reduction", "300% deployment improvement", "6-person team"],
        evidence_source: "CV"
      }
    ]
  };
}

function generateMockJobProfile(content: string): JobProfile {
  return {
    title: "Senior Full Stack Engineer",
    level: "Senior (L5-L6)",
    must_haves: [
      "5+ years of professional software development experience",
      "Strong proficiency in React and modern JavaScript/TypeScript",
      "Experience with Node.js and backend API development",
      "Familiarity with cloud platforms (AWS, GCP, or Azure)",
      "Experience with relational databases and SQL",
      "Strong problem-solving and debugging skills"
    ],
    nice_haves: [
      "Experience with microservices architecture",
      "Knowledge of containerization (Docker/Kubernetes)",
      "Experience mentoring junior developers",
      "Understanding of system design principles",
      "Experience with CI/CD pipelines"
    ],
    responsibilities: [
      "Design and develop scalable web applications",
      "Collaborate with product and design teams",
      "Mentor junior engineers and conduct code reviews",
      "Participate in architectural decisions",
      "Optimize application performance and scalability"
    ],
    competencies: [
      {
        name: "Technical Excellence",
        signals: ["Clean code practices", "System design thinking", "Performance optimization"]
      },
      {
        name: "Leadership",
        signals: ["Mentoring experience", "Cross-team collaboration", "Technical decision making"]
      },
      {
        name: "Problem Solving",
        signals: ["Debugging complex issues", "Scalability solutions", "Creative technical approaches"]
      }
    ]
  };
}

function generateMockGapAnalysis(jobProfile: JobProfile): GapAnalysis {
  return {
    coverage: {
      "5+ years of professional software development experience": "covered",
      "Strong proficiency in React and modern JavaScript/TypeScript": "covered",
      "Experience with Node.js and backend API development": "covered",
      "Familiarity with cloud platforms (AWS, GCP, or Azure)": "covered",
      "Experience with relational databases and SQL": "covered",
      "Strong problem-solving and debugging skills": "unknown"
    },
    open: ["Strong problem-solving and debugging skills"]
  };
}

function generateMockInterviewSummary(jobProfile: JobProfile): InterviewSummary {
  return {
    overall_fit: "Strong",
    competency_scores: [
      {
        competency: "Technical Excellence",
        score: 4,
        evidence: [
          "Demonstrated deep understanding of React and modern JavaScript",
          "Showed strong system design thinking in architecture discussion"
        ],
        risks: ["Could benefit from more exposure to large-scale system challenges"]
      },
      {
        competency: "Leadership", 
        score: 5,
        evidence: [
          "Clear examples of mentoring junior developers",
          "Led successful team migration project with measurable results"
        ],
        risks: []
      },
      {
        competency: "Problem Solving",
        score: 4,
        evidence: [
          "Articulated systematic approach to debugging complex issues",
          "Provided concrete example of performance optimization"
        ],
        risks: ["Would like to see more examples of handling ambiguous requirements"]
      }
    ],
    gaps: ["Would benefit from exposure to larger scale distributed systems"],
    follow_ups: [
      "Deep dive on system design for high-traffic applications",
      "Discuss experience with incident response and on-call processes",
      "Explore passion projects and continuous learning approach"
    ],
    evidence_matrix: [
      {
        requirement: "Strong proficiency in React and modern JavaScript/TypeScript",
        evidence: [
          { quote: "I've been using React for 6 years, including hooks, context, and TypeScript integration", timestamp: "00:02:15" },
          { quote: "Recently led our team's migration from class components to functional components with hooks", timestamp: "00:04:22" }
        ]
      }
    ]
  };
}

function transformParsedCVToProfile(parsedCV: any): CandidateProfile {
  // Transform the parsed CV structure to match our CandidateProfile interface
  return {
    basics: {
      name: parsedCV.personalInfo?.name || 'Unknown',
      location: parsedCV.personalInfo?.location || '',
      years_experience: calculateYearsOfExperience(parsedCV.experience || []),
      education: parsedCV.education?.map((edu: any) => 
        `${edu.degree} - ${edu.institution} (${edu.graduationDate})`
      ) || []
    },
    roles: parsedCV.experience?.map((exp: any) => ({
      title: exp.title,
      company: exp.company,
      start: exp.startDate,
      end: exp.endDate,
      achievements: exp.achievements || [],
      tools: exp.technologies || [],
      domains: exp.domains || [exp.title] // Fallback to title if no domains
    })) || [],
    skills: parsedCV.skills || {},
    certs: parsedCV.certifications?.map((cert: any) => cert.name) || [],
    highlights: [] // Will be populated by further analysis
  };
}

function calculateYearsOfExperience(experience: any[]): number {
  if (!experience || experience.length === 0) return 0;
  
  // Simple calculation - you might want to make this more sophisticated
  let totalMonths = 0;
  
  experience.forEach(exp => {
    const start = new Date(exp.startDate + '-01');
    const end = exp.endDate === 'present' ? new Date() : new Date(exp.endDate + '-01');
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    totalMonths += diffMonths;
  });
  
  return Math.floor(totalMonths / 12);
}