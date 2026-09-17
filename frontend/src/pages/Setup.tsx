/**
 * Setup page - CV upload, job description input, and gap analysis
 * Handles file processing and profile extraction
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, Briefcase, AlertTriangle, CheckCircle, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { UploadCard } from '@/components/UploadCard';
import { BatchUploadCard } from '@/components/BatchUploadCard';
import { JsonPretty } from '@/components/JsonPretty';
import { GapTable } from '@/components/GapTable';
import { RobustGapTable } from '@/components/RobustGapTable';
import { useInterviewStore } from '@/store/interview';
import { ingestCV, ingestJD } from '@/lib/api';
import { generateInterviewQuestions } from '@/services/aiServices';
import { computeGapAnalysis } from '@/lib/gap';
import { saveCVAnalysis, saveGapAnalysis } from '@/lib/analysisStorage';
import { supabase } from '@/integrations/supabase/client';
import type { CandidateProfile, JobProfile } from '@/types';

export default function Setup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    candidate, 
    job, 
    gap, 
    robustGap,
    transcript,
    evidence,
    setCandidate, 
    setJob, 
    setGap,
    setRobustGap,
    canProceedToInterview 
  } = useInterviewStore();
  
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvProcessing, setCvProcessing] = useState(false);
  const [cvError, setCvError] = useState<string>("");
  const [useBatchMode, setUseBatchMode] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<Array<{
    file: File;
    status: 'pending' | 'processing' | 'success' | 'error';
    result?: any;
    error?: string;
  }>>([]);
  
  const [jobDescription, setJobDescription] = useState("");
  const [jdProcessing, setJdProcessing] = useState(false);
  const [jdError, setJdError] = useState<string>("");
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState<string>("");

  // Check if applying to a specific job posting
  useEffect(() => {
    const checkJobPosting = async () => {
      const jobId = sessionStorage.getItem('applying_job_id');
      if (jobId) {
        setApplyingJobId(jobId);
        setJdProcessing(true);
        
        // Fetch job posting details
        const { data: jobPosting, error } = await supabase
          .from('job_postings')
          .select('*')
          .eq('id', jobId)
          .single();
        
        if (error) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load job posting details",
          });
          sessionStorage.removeItem('applying_job_id');
          setJdProcessing(false);
          return;
        }
        
        if (jobPosting) {
          setJobTitle(jobPosting.title);
          // Auto-fill job description
          const fullDescription = `${jobPosting.title}\n\n${jobPosting.description || ''}\n\nRequirements:\n${jobPosting.requirements || ''}`;
          setJobDescription(fullDescription);
          
          // Automatically analyze the job description
          try {
            const response = await ingestJD(fullDescription.trim());
            
            if (response.ok && response.data) {
              setJob(response.data.job_profile);
              if (response.data.gap) {
                setGap(response.data.gap);
              }
              
              // Compute robust gap analysis if we have both profiles
              if (candidate && response.data.job_profile) {
                const robustGapResult = computeGapAnalysis({
                  candidate,
                  job: response.data.job_profile,
                });
                setRobustGap(robustGapResult);
              }
              
              toast({
                title: "Job Requirements Loaded",
                description: `Ready to interview for ${jobPosting.title}`,
              });
            }
          } catch (error) {
            console.error('Auto JD analysis error:', error);
          } finally {
            setJdProcessing(false);
          }
        }
      }
    };
    
    checkJobPosting();
  }, [candidate]);
  
  const handleCVUpload = async (file: File) => {
    setCvFile(file);
    setCvError("");
    setCvProcessing(true);
    
    try {
      console.log('🚀 Starting CV upload and processing:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      const response = await ingestCV(file);
      
      if (response.ok && response.data) {
        setCandidate(response.data);
        
        // Save to database
        await saveCVAnalysis({
          file_name: file.name,
          file_size: file.size,
          candidate_profile: response.data,
        });
        
        toast({
          title: "CV Processed Successfully",
          description: `Extracted profile for ${response.data.basics?.name || 'candidate'}`,
        });
      } else {
        const errorMessage = response.error || "Failed to process CV";
        console.error('CV processing failed:', errorMessage);
        setCvError(errorMessage);
        toast({
          variant: "destructive",
          title: "CV Processing Failed",
          description: errorMessage,
        });
      }
    } catch (error) {
      const errorMessage = "An unexpected error occurred while processing the CV";
      console.error('CV upload error:', error);
      setCvError(errorMessage);
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: errorMessage,
      });
    } finally {
      setCvProcessing(false);
    }
  };
  
  const handleCVRemove = () => {
    setCvFile(null);
    setCvError("");
    setCandidate(null);
  };

  const handleBatchProcess = async (files: File[]) => {
    setBatchProcessing(true);
    const results = files.map(file => ({
      file,
      status: 'pending' as const,
    }));
    setProcessedFiles([...results]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Update status to processing
      setProcessedFiles(prev => prev.map((item, index) => 
        index === i ? { ...item, status: 'processing' } : item
      ));

      try {
        const response = await ingestCV(file);
        
        if (response.ok && response.data) {
          // Save to database
          await saveCVAnalysis({
            file_name: file.name,
            file_size: file.size,
            candidate_profile: response.data,
          });

          // Update status to success
          setProcessedFiles(prev => prev.map((item, index) => 
            index === i ? { ...item, status: 'success', result: response.data } : item
          ));
        } else {
          // Update status to error
          setProcessedFiles(prev => prev.map((item, index) => 
            index === i ? { ...item, status: 'error', error: response.error || 'Processing failed' } : item
          ));
        }
      } catch (error) {
        // Update status to error
        setProcessedFiles(prev => prev.map((item, index) => 
          index === i ? { ...item, status: 'error', error: 'An unexpected error occurred' } : item
        ));
      }
    }

    setBatchProcessing(false);
    const successCount = processedFiles.filter(f => f.status === 'success').length;
    toast({
      title: "Batch Processing Complete",
      description: `Successfully processed ${successCount} out of ${files.length} CVs`,
    });
  };

  const handleClearBatch = () => {
    setProcessedFiles([]);
  };
  
  const handleJDAnalysis = async () => {
    if (!jobDescription.trim()) {
      setJdError("Please enter a job description");
      return;
    }
    
    setJdError("");
    setJdProcessing(true);
    
    try {
      console.log('🚀 Starting job description analysis:', {
        contentLength: jobDescription.length
      });

      const response = await ingestJD(jobDescription.trim());
      
      if (response.ok && response.data) {
        setJob(response.data.job_profile);
        if (response.data.gap) {
          setGap(response.data.gap);
        }
        
        // Compute robust gap analysis if we have both profiles
        if (candidate && response.data.job_profile) {
          const robustGapResult = computeGapAnalysis({
            candidate,
            job: response.data.job_profile,
          });
          setRobustGap(robustGapResult);
          
          // Save gap analysis if we have candidate data
          const cvAnalysisResult = await saveCVAnalysis({
            file_name: cvFile?.name || 'job_analysis',
            file_size: cvFile?.size,
            candidate_profile: candidate,
          });
          
          if (cvAnalysisResult) {
            await saveGapAnalysis({
              cv_analysis_id: cvAnalysisResult.id!,
              job_profile: response.data.job_profile,
              gap_analysis: response.data.gap,
              robust_gap_analysis: robustGapResult,
              job_description: jobDescription.trim(),
              job_posting_id: applyingJobId || undefined,
            });
          }
        }
        
        toast({
          title: "Job Description Analyzed",
          description: `Extracted ${response.data.job_profile.must_haves?.length || 0} requirements for ${response.data.job_profile.title}`,
        });
      } else {
        const errorMessage = response.error || "Failed to analyze job description";
        console.error('JD analysis failed:', errorMessage);
        setJdError(errorMessage);
        toast({
          variant: "destructive",
          title: "Analysis Failed",
          description: errorMessage,
        });
      }
    } catch (error) {
      const errorMessage = "An unexpected error occurred while analyzing the job description";
      console.error('JD analysis error:', error);
      setJdError(errorMessage);
      toast({
        variant: "destructive",
        title: "Analysis Error",
        description: errorMessage,
      });
    } finally {
      setJdProcessing(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Interview Setup</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Upload the candidate's CV and job description to begin the intelligent analysis process
          </p>
          <div className="mt-4">
            <Badge variant="default" className="bg-gradient-hero">
              🤖 AI-Powered Analysis Enabled
            </Badge>
          </div>
        </div>
        
        {/* Progress Indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-4">
            <div className="progress-step active">1</div>
            <div className="w-12 h-1 bg-primary rounded" />
            <div className={`progress-step ${candidate && job ? 'completed' : 'inactive'}`}>2</div>
            <div className={`w-12 h-1 rounded ${candidate && job ? 'bg-primary' : 'bg-muted'}`} />
            <div className="progress-step inactive">3</div>
            <div className="w-12 h-1 bg-muted rounded" />
            <div className="progress-step inactive">4</div>
          </div>
        </div>
        
        {/* Processing Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="bg-secondary/30 p-1 rounded-lg">
            <Button
              variant={!useBatchMode ? "default" : "ghost"}
              size="sm"
              onClick={() => setUseBatchMode(false)}
            >
              Single CV
            </Button>
            <Button
              variant={useBatchMode ? "default" : "ghost"}
              size="sm"
              onClick={() => setUseBatchMode(true)}
            >
              Batch Processing
            </Button>
          </div>
        </div>

        {/* Main Content - Row Layout */}
        <div className="space-y-8 mb-8">
          {/* CV Upload Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-center">CV Analysis</h2>
            {!useBatchMode ? (
              <UploadCard
                onFileSelect={handleCVUpload}
                onFileRemove={handleCVRemove}
                isProcessing={cvProcessing}
                selectedFile={cvFile}
                error={cvError}
                success={!!candidate}
              />
            ) : (
              <BatchUploadCard
                onFilesProcess={handleBatchProcess}
                isProcessing={batchProcessing}
                processedFiles={processedFiles}
                onClearFiles={handleClearBatch}
              />
            )}
          </div>

          {/* Job Description Section - Hidden when applying to a job posting */}
          {!applyingJobId && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-center">Job Requirements Analysis</h2>
              <Card className="bg-gradient-card shadow-soft border-primary/10 max-w-4xl mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Job Description
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Paste the job description here... Include requirements, responsibilities, and desired skills."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="min-h-48 resize-none"
                    disabled={jdProcessing}
                  />
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {jobDescription.length} characters
                    </div>
                    <Button
                      onClick={handleJDAnalysis}
                      disabled={!jobDescription.trim() || jdProcessing}
                      className="bg-gradient-hero"
                    >
                      {jdProcessing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          Extract Requirements
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {jdError && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{jdError}</AlertDescription>
                    </Alert>
                  )}
                  
                  {job && !jdError && (
                    <Alert className="bg-emerald-50 border-emerald-200">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-700">
                        Job requirements successfully analyzed
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Show job info when applying to a specific posting */}
          {applyingJobId && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-center">Applying for: {jobTitle}</h2>
              <Card className="bg-gradient-card shadow-soft border-primary/10 max-w-4xl mx-auto">
                <CardContent className="py-8 text-center">
                  {jdProcessing ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span className="text-muted-foreground">Analyzing job requirements...</span>
                    </div>
                  ) : job ? (
                    <Alert className="bg-emerald-50 border-emerald-200">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-700">
                        Job requirements successfully analyzed. Upload your CV to continue.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Analysis Results Section */}
          {(candidate || job) && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-center">Analysis Results</h2>
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Candidate Profile */}
                {candidate && (
                  <Card className="bg-gradient-card shadow-soft border-emerald-200">
                    <JsonPretty 
                      data={candidate} 
                      title="Candidate Profile"
                      className="p-6"
                    />
                  </Card>
                )}
                
                {/* Job Profile */}
                {job && (
                  <Card className="bg-gradient-card shadow-soft border-accent/20">
                    <JsonPretty 
                      data={job} 
                      title="Job Requirements"
                      className="p-6"
                    />
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Gap Analysis */}
        {job && candidate && (
          <div className="mb-8 space-y-6">
            {/* Enhanced Gap Analysis */}
            {robustGap && (
              <RobustGapTable 
                gapAnalysis={robustGap}
              />
            )}
            
            {/* Original Gap Analysis (fallback) */}
            {!robustGap && (
              <GapTable 
                jobProfile={job}
                gapAnalysis={gap}
                evidence={evidence}
              />
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => {
              if (applyingJobId) {
                sessionStorage.removeItem('applying_job_id');
                navigate('/browse-jobs');
              } else {
                navigate('/');
              }
            }}
          >
            {applyingJobId ? 'Back to Job Postings' : 'Back to Home'}
          </Button>
          
          <div className="flex items-center gap-4">
            {canProceedToInterview() ? (
              <div className="flex items-center gap-3">
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Ready for Interview
                </Badge>
                <Button
                  size="lg"
                  onClick={async () => {
                    try {
                      // Generate dynamic questions based on candidate profile and job
                      if (candidate && job) {
                        console.log('📝 Generating interview questions...');
                        const questionsResult = await generateInterviewQuestions(
                          job.title || 'Position',
                          candidate,
                          'mid'
                        );
                        
                        if (questionsResult.success && questionsResult.data) {
                          const { setGeneratedQuestions } = useInterviewStore.getState();
                          setGeneratedQuestions(questionsResult.data);
                          console.log('✅ Generated', questionsResult.data.length, 'interview questions');
                        } else {
                          console.warn('⚠️ Failed to generate questions, will use defaults');
                        }
                      }

                      if (applyingJobId) {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error('Not authenticated');

                        // Get job posting to get recruiter_id
                        const { data: jobPosting, error: jobError } = await supabase
                          .from('job_postings')
                          .select('user_id')
                          .eq('id', applyingJobId)
                          .single();

                        if (jobError) throw jobError;

                        // Create interview session
                        const { data: session, error: sessionError } = await supabase
                          .from('interview_sessions')
                          .insert({
                            job_posting_id: applyingJobId,
                            candidate_id: user.id,
                            recruiter_id: jobPosting.user_id,
                            status: 'scheduled',
                          })
                          .select()
                          .single();

                        if (sessionError) throw sessionError;

                        sessionStorage.removeItem('applying_job_id');
                        toast({
                          title: "Interview Started",
                          description: "Good luck!",
                        });
                        navigate(`/interview?session=${session.id}`);
                      } else {
                        navigate('/interview');
                      }
                    } catch (error: any) {
                      console.error('Error starting interview:', error);
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: error.message || 'Failed to start interview',
                      });
                    }
                  }}
                  className="bg-gradient-hero hover:scale-105 transition-bounce shadow-medium"
                >
                  Start Interview
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {!candidate && !job ? 'Upload CV & JD' : !candidate ? 'Upload CV' : 'Analyze JD'}
                </Badge>
                <Button disabled size="lg" variant="outline">
                  Complete Setup First
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}