import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backendApi } from "@/lib/backendApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Eye, Calendar } from "lucide-react";
import { toast } from "sonner";
import { UserMenu } from "@/components/UserMenu";

interface InterviewWithDetails {
  id: string;
  candidate_id: string;
  job_posting_id: string;
  status: string;
  scheduled_at: string;
  started_at: string;
  completed_at: string;
  created_at: string;
  candidate_email?: string;
  candidate_name?: string;
  job_title?: string;
  interview_analysis?: any[];
  response_count?: number;
}

export default function InterviewerDashboard() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<InterviewWithDetails[]>([]);
  const [gapAnalyses, setGapAnalyses] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInterviewerData();
  }, []);

  const fetchInterviewerData = async () => {
    try {
      const data = await backendApi.getInterviewerDashboard();

      setInterviews(data.sessions || []);
      setGapAnalyses(data.gap_analyses || []);
      setResponses(data.responses || []);
    } catch (error: any) {
      toast.error("Error loading dashboard data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-content">
      <div className="dashboard-header flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <div className="dashboard-kicker">Recruiter // Operations console</div>
          <h1 className="dashboard-title">Interviewer dashboard</h1>
          <p className="text-muted-foreground">Monitor candidate signal across active hiring workflows.</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => navigate('/job-postings')}
            className="bg-gradient-hero"
          >
            <Briefcase className="w-4 h-4 mr-2" />
            Manage Job Postings
          </Button>
          <UserMenu />
        </div>
      </div>

      <Tabs defaultValue="interviews" className="w-full">
        <TabsList>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
          <TabsTrigger value="gaps">Gap Analysis</TabsTrigger>
          <TabsTrigger value="responses">Responses</TabsTrigger>
        </TabsList>

        <TabsContent value="interviews" className="space-y-4">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle>Interview Sessions</CardTitle>
              <CardDescription>All interviews from your job postings</CardDescription>
            </CardHeader>
            <CardContent>
              {interviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No interview sessions yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Job Position</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Responses</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interviews.map((interview) => (
                      <TableRow key={interview.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{interview.candidate_name}</span>
                            <span className="text-xs text-muted-foreground">{interview.candidate_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>{interview.job_title}</TableCell>
                        <TableCell>
                          <Badge variant={
                            interview.status === 'completed' ? 'default' :
                            interview.status === 'in_progress' ? 'secondary' : 'outline'
                          }>
                            {interview.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3" />
                            {interview.completed_at 
                              ? new Date(interview.completed_at).toLocaleDateString()
                              : interview.started_at
                              ? new Date(interview.started_at).toLocaleDateString()
                              : new Date(interview.scheduled_at || interview.created_at).toLocaleDateString()
                            }
                          </div>
                        </TableCell>
                        <TableCell>{interview.response_count}</TableCell>
                        <TableCell>
                          {interview.interview_analysis?.[0]?.overall_score ? (
                            <Badge variant="default">
                              {interview.interview_analysis[0].overall_score}/100
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/summary?session=${interview.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle>Gap Analysis Results</CardTitle>
              <CardDescription>Skills gap analysis per candidate</CardDescription>
            </CardHeader>
            <CardContent>
              {gapAnalyses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No gap analysis data available
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Job Title (JD)</TableHead>
                      <TableHead>Applied For</TableHead>
                      <TableHead>Analysis Date</TableHead>
                      <TableHead>Match Score</TableHead>
                      <TableHead>Gaps</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gapAnalyses.map((gap) => (
                      <TableRow key={gap.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{gap.candidate_name}</span>
                            <span className="text-xs text-muted-foreground">{gap.candidate_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>{gap.job_profile?.title || "N/A"}</TableCell>
                        <TableCell>{gap.job_posting_title || gap.job_title_from_session || "-"}</TableCell>
                        <TableCell>{new Date(gap.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {(() => {
                            const items = gap.robust_gap_analysis?.items || [];
                            const matchScore = items.length > 0 
                              ? Math.round((items.filter((item: any) => item.coverage === 'covered').length / items.length) * 100)
                              : 0;
                            
                            return (
                              <Badge variant={matchScore > 70 ? "default" : "secondary"}>
                                {matchScore}%
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-1">
                            {(() => {
                              const items = gap.robust_gap_analysis?.items || [];
                              const weakOrUncovered = items.filter((item: any) => 
                                item.coverage === 'weak' || item.coverage === 'unknown'
                              );
                              
                              if (weakOrUncovered.length === 0) {
                                return <span className="text-muted-foreground">No gaps</span>;
                              }
                              
                              return weakOrUncovered.slice(0, 3).map((item: any, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs block mb-1">
                                  {item.requirement?.slice(0, 40)}{item.requirement?.length > 40 ? '...' : ''}
                                </Badge>
                              ));
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responses" className="space-y-4">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle>Interview Responses</CardTitle>
              <CardDescription>Recent candidate responses to interview questions</CardDescription>
            </CardHeader>
            <CardContent>
              {responses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No responses yet
                </div>
              ) : (
                <div className="space-y-4">
                  {responses.slice(0, 10).map((response) => (
                    <Card key={response.id} className="dashboard-card bg-accent/5">
                      <CardHeader>
                        <CardTitle className="text-lg">
                          {response.question_text || response.interview_questions?.question_text}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4">
                          <span>
                            Score: {response.score ? (
                              <Badge variant="default">{response.score}/100</Badge>
                            ) : (
                              "Not scored"
                            )}
                          </span>
                          <span>Duration: {response.duration_seconds}s</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {response.response_text || response.transcript || "No transcript available"}
                        </p>
                        {response.ai_analysis && (
                          <div className="mt-4 p-3 bg-background rounded-lg border">
                            <p className="text-xs font-semibold mb-1">AI Analysis:</p>
                            <p className="text-xs text-muted-foreground">
                              {typeof response.ai_analysis === 'string' 
                                ? response.ai_analysis 
                                : JSON.stringify(response.ai_analysis, null, 2)
                              }
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
