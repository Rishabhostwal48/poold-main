/**
 * Summary page - Interview results, scoring, and export functionality
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, RotateCcw, CheckCircle, Star, TrendingUp, AlertTriangle, Users, Brain, MessageSquare, Trophy, Target, BookOpen, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useInterviewStore } from '@/store/interview';
import { generateInterviewSummary } from '@/services/aiServices';

export default function Summary() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { candidate, job, transcript, evidence, getCoveragePercent, reset } = useInterviewStore();
  
  const [assessment, setAssessment] = useState<{
    overallScore: number;
    recommendation: 'strong_hire' | 'hire' | 'further_interview' | 'pass';
    confidence: number;
    technicalSkills: {
      score: number;
      strengths: string[];
      weaknesses: string[];
      evidence: string[];
    };
    softSkills: {
      communication: number;
      problemSolving: number;
      leadership: number;
      teamwork: number;
      adaptability: number;
    };
    culturefit: {
      score: number;
      indicators: string[];
      reasoning: string;
    };
    keyStrengths: string[];
    areasForImprovement: string[];
    redFlags: string[];
    detailedAssessment: string;
    nextSteps: string[];
    salaryRecommendation?: {
      range: string;
      reasoning: string;
    };
    interviewHighlights: string[];
    questionsConcerns: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Generate assessment on component mount
  useEffect(() => {
    const generateAssessment = async () => {
      if (!candidate || !job || !transcript.length) {
        setIsLoading(false);
        return;
      }

      try {
        const result = await generateInterviewSummary({
          candidate,
          job,
          transcript,
          evidence
        });

        if (result.success && result.data) {
          setAssessment(result.data);
        } else {
          toast({
            title: "Assessment Error",
            description: result.error || "Failed to generate assessment",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Assessment generation error:', error);
        toast({
          title: "Assessment Error", 
          description: "Failed to generate interview assessment",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    generateAssessment();
  }, [candidate, job, transcript, evidence, toast]);

  const handleNewInterview = () => {
    reset();
    navigate('/setup');
  };
  
  const handleExportJSON = () => {
    const data = { 
      candidate, 
      job, 
      transcript, 
      evidence,
      assessment,
      generatedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-summary-${candidate?.basics?.name?.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'strong_hire': return 'bg-success text-success-foreground';
      case 'hire': return 'bg-primary text-primary-foreground';
      case 'further_interview': return 'bg-warning text-warning-foreground';
      case 'pass': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getRecommendationText = (recommendation: string) => {
    switch (recommendation) {
      case 'strong_hire': return 'Strong Hire';
      case 'hire': return 'Hire';
      case 'further_interview': return 'Further Interview';
      case 'pass': return 'Pass';
      default: return 'Under Review';
    }
  };

  const formatScore = (score: number) => {
    if (score >= 90) return { color: 'text-success', label: 'Excellent' };
    if (score >= 80) return { color: 'text-primary', label: 'Strong' };
    if (score >= 70) return { color: 'text-warning', label: 'Good' };
    if (score >= 60) return { color: 'text-accent', label: 'Fair' };
    return { color: 'text-destructive', label: 'Needs Improvement' };
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Analyzing Interview...</h1>
            <p className="text-muted-foreground">Generating comprehensive assessment</p>
            <div className="mt-6">
              <Progress value={undefined} className="w-64 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Interview Assessment Complete</h1>
          <p className="text-muted-foreground">
            Comprehensive analysis for {candidate?.basics?.name} • {job?.title}
          </p>
        </div>

        {/* Overall Assessment Card */}
        <Card className="bg-gradient-card shadow-strong mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Overall Assessment
              </span>
              {assessment && (
                <Badge className={`text-lg px-4 py-2 ${getRecommendationColor(assessment.recommendation)}`}>
                  <Star className="w-4 h-4 mr-2" />
                  {getRecommendationText(assessment.recommendation)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score Overview */}
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className={`text-4xl font-bold ${assessment ? formatScore(assessment.overallScore).color : 'text-muted'}`}>
                  {assessment ? assessment.overallScore : getCoveragePercent()}
                </div>
                <div className="text-sm text-muted-foreground">Overall Score</div>
                {assessment && (
                  <Badge variant="outline" className="mt-1">
                    {formatScore(assessment.overallScore).label}
                  </Badge>
                )}
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{getCoveragePercent()}%</div>
                <div className="text-sm text-muted-foreground">Requirements Covered</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-success">{transcript.length}</div>
                <div className="text-sm text-muted-foreground">Interview Exchanges</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-accent">{Object.keys(evidence).length}</div>
                <div className="text-sm text-muted-foreground">Evidence Points</div>
              </div>
            </div>

            {/* Assessment Summary */}
            {assessment && (
              <div className="bg-card/50 rounded-lg p-4 border">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Assessment Summary
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  {assessment.detailedAssessment}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Analysis */}
        {assessment && (
          <Tabs defaultValue="skills" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="skills">Skills Analysis</TabsTrigger>
              <TabsTrigger value="strengths">Strengths & Areas</TabsTrigger>
              <TabsTrigger value="culture">Culture Fit</TabsTrigger>
              <TabsTrigger value="recommendations">Next Steps</TabsTrigger>
            </TabsList>

            {/* Skills Analysis Tab */}
            <TabsContent value="skills">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Technical Skills */}
                <Card className="bg-gradient-card shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-primary" />
                      Technical Skills
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Overall Technical Score</span>
                      <Badge className={formatScore(assessment.technicalSkills.score).color}>
                        {assessment.technicalSkills.score}/100
                      </Badge>
                    </div>
                    <Progress value={assessment.technicalSkills.score} className="h-2" />
                    
                    <div className="space-y-3 mt-4">
                      <div>
                        <h5 className="font-medium text-success mb-2">Technical Strengths</h5>
                        <ul className="space-y-1">
                          {assessment.technicalSkills.strengths.map((strength: string, idx: number) => (
                            <li key={idx} className="text-sm flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-success" />
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {assessment.technicalSkills.weaknesses.length > 0 && (
                        <div>
                          <h5 className="font-medium text-warning mb-2">Areas for Development</h5>
                          <ul className="space-y-1">
                            {assessment.technicalSkills.weaknesses.map((weakness: string, idx: number) => (
                              <li key={idx} className="text-sm flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3 text-warning" />
                                {weakness}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Soft Skills */}
                <Card className="bg-gradient-card shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Soft Skills Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(assessment.softSkills).map(([skill, score]) => (
                      <div key={skill} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium capitalize">
                            {skill.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className={`text-sm font-bold ${formatScore(score as number).color}`}>
                            {score}/100
                          </span>
                        </div>
                        <Progress value={score as number} className="h-1.5" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Strengths & Areas Tab */}
            <TabsContent value="strengths">
              <div className="grid lg:grid-cols-2 gap-6">
                <Card className="bg-gradient-card shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-success">
                      <TrendingUp className="w-5 h-5" />
                      Key Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {assessment.keyStrengths.map((strength: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-3 p-3 bg-success/10 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-warning">
                      <Target className="w-5 h-5" />
                      Areas for Improvement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {assessment.areasForImprovement.map((area: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg">
                          <BookOpen className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{area}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {assessment.redFlags.length > 0 && (
                <Card className="bg-gradient-card shadow-soft border-destructive/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-5 h-5" />
                      Concerns & Red Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {assessment.redFlags.map((flag: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Culture Fit Tab */}
            <TabsContent value="culture">
              <Card className="bg-gradient-card shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Culture Fit Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium">Culture Fit Score</span>
                    <div className="flex items-center gap-3">
                      <Progress value={assessment.culturefit.score} className="w-32 h-3" />
                      <Badge className={formatScore(assessment.culturefit.score).color}>
                        {assessment.culturefit.score}/100
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-3">Assessment Reasoning</h4>
                    <p className="text-muted-foreground leading-relaxed">
                      {assessment.culturefit.reasoning}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Cultural Indicators</h4>
                    <ul className="space-y-2">
                      {assessment.culturefit.indicators.map((indicator: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          {indicator}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recommendations Tab */}
            <TabsContent value="recommendations">
              <div className="space-y-6">
                <Card className="bg-gradient-card shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      Recommended Next Steps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {assessment.nextSteps.map((step: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-3 p-4 bg-primary/5 rounded-lg">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center mt-0.5">
                            {idx + 1}
                          </div>
                          <span className="text-sm">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {assessment.salaryRecommendation?.range && (
                  <Card className="bg-gradient-card shadow-soft">
                    <CardHeader>
                      <CardTitle>Salary Recommendation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-2xl font-bold text-primary">
                        {assessment.salaryRecommendation.range}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {assessment.salaryRecommendation.reasoning}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {assessment.interviewHighlights.length > 0 && (
                  <Card className="bg-gradient-card shadow-soft">
                    <CardHeader>
                      <CardTitle>Interview Highlights</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {assessment.interviewHighlights.map((highlight: string, idx: number) => (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            <Star className="w-4 h-4 text-warning" />
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mt-8">
          <Button onClick={handleExportJSON} className="bg-gradient-hero">
            <Download className="w-4 h-4 mr-2" />
            Export Complete Report
          </Button>
          <Button variant="outline" onClick={handleNewInterview}>
            <RotateCcw className="w-4 h-4 mr-2" />
            New Interview
          </Button>
           <Button variant="outline" onClick={() => navigate('/interviewee')}>
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}