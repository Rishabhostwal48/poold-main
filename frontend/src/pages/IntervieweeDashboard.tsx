import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Target, Video, FileUp, Briefcase } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";

export default function IntervieweeDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    cvAnalyses: 0,
    gapAnalyses: 0,
    interviews: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;

      const [cvCount, gapCount, interviewCount] = await Promise.all([
        supabase.from("cv_analysis_results").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("gap_analysis_results").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("interview_sessions").select("*", { count: "exact", head: true }).eq("candidate_id", userId),
      ]);

      setStats({
        cvAnalyses: cvCount.count || 0,
        gapAnalyses: gapCount.count || 0,
        interviews: interviewCount.count || 0,
      });
    } catch (error: any) {
      toast.error("Error loading stats: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-4xl font-bold">Welcome to Your Dashboard</h1>
          <p className="text-muted-foreground">Manage your career journey all in one place</p>
        </div>
        <UserMenu />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              CV Analyses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.cvAnalyses}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Gap Analyses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.gapAnalyses}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Interviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.interviews}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Browse Job Openings</CardTitle>
            <CardDescription>Find and apply to active job postings</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/browse-jobs")} className="w-full">
              <Briefcase className="mr-2 h-4 w-4" />
              Browse Jobs
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload & Analyze CV</CardTitle>
            <CardDescription>Get AI-powered insights on your resume</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/setup")} className="w-full">
              <FileUp className="mr-2 h-4 w-4" />
              Upload CV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Start Interview Practice</CardTitle>
            <CardDescription>Practice with AI-powered mock interviews</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/interview")} className="w-full">
              <Video className="mr-2 h-4 w-4" />
              Start Interview
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gap Analysis</CardTitle>
            <CardDescription>Compare your skills with job requirements</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/setup")} variant="outline" className="w-full">
              <Target className="mr-2 h-4 w-4" />
              Analyze Skills Gap
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>View Summary</CardTitle>
            <CardDescription>Review your interview performance</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/summary")} variant="outline" className="w-full">
              <FileText className="mr-2 h-4 w-4" />
              View Results
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
