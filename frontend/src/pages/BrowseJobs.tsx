import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Briefcase, MapPin, DollarSign, FileUp, Video } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';

interface JobPosting {
  id: string;
  title: string;
  company_name: string | null;
  description: string | null;
  requirements: string | null;
  location: string | null;
  salary_range: string | null;
  employment_type: string | null;
  status: string;
  created_at: string;
  user_id: string;
}

export default function BrowseJobs() {
  const navigate = useNavigate();
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [showApplyDialog, setShowApplyDialog] = useState(false);

  useEffect(() => {
    fetchJobPostings();
  }, []);

  const fetchJobPostings = async () => {
    try {
      const { data, error } = await supabase
        .from('job_postings')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobPostings(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch job postings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClick = (job: JobPosting) => {
    setSelectedJob(job);
    setShowApplyDialog(true);
  };

  const handleCvUploadRedirect = () => {
    if (!selectedJob) return;
    
    // Store job ID in session storage for later use
    sessionStorage.setItem('applying_job_id', selectedJob.id);
    navigate('/setup');
  };

  const handleStartInterview = async () => {
    if (!selectedJob) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create application
      const { data: application, error: appError } = await supabase
        .from('applications')
        .insert({
          opportunity_id: selectedJob.id,
          applicant_id: user.id,
          status: 'pending',
        })
        .select()
        .single();

      if (appError) throw appError;

      // Create interview session
      const { data: session, error: sessionError } = await supabase
        .from('interview_sessions')
        .insert({
          job_posting_id: selectedJob.id,
          candidate_id: user.id,
          recruiter_id: selectedJob.user_id,
          status: 'scheduled',
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      toast.success('Interview session created!');
      navigate(`/interview?session=${session.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to start interview');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Browse Job Openings</h1>
            <p className="text-muted-foreground">
              Find opportunities and apply with your CV or start an interview
            </p>
          </div>
          <UserMenu />
        </div>

        <div className="grid gap-4">
          {jobPostings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No active job postings available at the moment.</p>
              </CardContent>
            </Card>
          ) : (
            jobPostings.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-2xl">{job.title}</CardTitle>
                        <Badge variant="default">Active</Badge>
                      </div>
                      {job.company_name && (
                        <p className="text-muted-foreground">{job.company_name}</p>
                      )}
                    </div>
                    <Button onClick={() => handleApplyClick(job)}>
                      Apply Now
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {job.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </div>
                    )}
                    {job.salary_range && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {job.salary_range}
                      </div>
                    )}
                    {job.employment_type && (
                      <Badge variant="outline">{job.employment_type}</Badge>
                    )}
                  </div>

                  {job.description && (
                    <div>
                      <h4 className="font-semibold mb-2">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {job.description}
                      </p>
                    </div>
                  )}

                  {job.requirements && (
                    <div>
                      <h4 className="font-semibold mb-2">Required Skills & Qualifications</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {job.requirements}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply to {selectedJob?.title}</DialogTitle>
            <DialogDescription>
              Choose how you'd like to apply for this position
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Card className="cursor-pointer hover:bg-accent transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <FileUp className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Upload & Analyze CV</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload your resume for AI-powered analysis
                    </p>
                    <Button
                      onClick={handleCvUploadRedirect}
                      className="w-full"
                    >
                      Go to CV Upload
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:bg-accent transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Video className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Start Interview</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Begin AI-powered mock interview session
                    </p>
                    <Button
                      onClick={handleStartInterview}
                      variant="outline"
                      className="w-full"
                    >
                      Start Interview
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
