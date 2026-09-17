/**
 * ResponseAnalysis component - Shows AI-powered analysis of candidate responses
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  MessageSquare, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Lightbulb,
  Flag
} from 'lucide-react';

interface ResponseAnalysisProps {
  analysis: {
    score: number;
    confidence: number;
    technicalAccuracy: number;
    communicationClarity: number;
    problemSolvingApproach: number;
    jobRelevance: number;
    experienceEvidence: number;
    strengths: string[];
    weaknesses: string[];
    technicalInsights: string[];
    softSkillsObserved: string[];
    redFlags: string[];
    positiveSignals: string[];
    followUpQuestions: string[];
    evidenceQuality: 'strong' | 'moderate' | 'weak' | 'none';
    improvementAreas: string[];
    overallAssessment: string;
    recommendation: 'excellent' | 'good' | 'fair' | 'poor';
    nextStepSuggestion: string;
  };
  className?: string;
}

export const ResponseAnalysis: React.FC<ResponseAnalysisProps> = ({ 
  analysis, 
  className = "" 
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-success';
    if (score >= 6) return 'text-primary';
    if (score >= 4) return 'text-warning';
    return 'text-destructive';
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'excellent': return 'bg-success text-success-foreground';
      case 'good': return 'bg-primary text-primary-foreground';
      case 'fair': return 'bg-warning text-warning-foreground';
      case 'poor': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getEvidenceQualityColor = (quality: string) => {
    switch (quality) {
      case 'strong': return 'text-success';
      case 'moderate': return 'text-primary';
      case 'weak': return 'text-warning';
      case 'none': return 'text-destructive';
      default: return 'text-muted';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall Score */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Response Analysis
            </span>
            <Badge className={getRecommendationColor(analysis.recommendation)}>
              {analysis.recommendation.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${getScoreColor(analysis.score)}`}>
                {analysis.score}/10
              </div>
              <div className="text-xs text-muted-foreground">Overall Score</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getScoreColor(analysis.confidence)}`}>
                {analysis.confidence}/10
              </div>
              <div className="text-xs text-muted-foreground">Confidence</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-semibold ${getEvidenceQualityColor(analysis.evidenceQuality)}`}>
                {analysis.evidenceQuality.toUpperCase()}
              </div>
              <div className="text-xs text-muted-foreground">Evidence Quality</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-accent">
                {analysis.positiveSignals.length}
              </div>
              <div className="text-xs text-muted-foreground">Positive Signals</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Scores */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Detailed Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Technical Accuracy', score: analysis.technicalAccuracy },
            { label: 'Communication Clarity', score: analysis.communicationClarity },
            { label: 'Problem Solving', score: analysis.problemSolvingApproach },
            { label: 'Job Relevance', score: analysis.jobRelevance },
            { label: 'Experience Evidence', score: analysis.experienceEvidence },
          ].map(({ label, score }) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className={`font-semibold ${getScoreColor(score)}`}>
                  {score}/10
                </span>
              </div>
              <Progress value={score * 10} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Key Observations */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Strengths */}
        <Card className="bg-gradient-card shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <TrendingUp className="w-4 h-4" />
              Strengths Observed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.strengths.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  {strength}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Areas for Improvement */}
        <Card className="bg-gradient-card shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <Lightbulb className="w-4 h-4" />
              Improvement Areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.improvementAreas.map((area, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <Lightbulb className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                  {area}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Technical Insights */}
      {analysis.technicalInsights.length > 0 && (
        <Card className="bg-gradient-card shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Technical Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.technicalInsights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  {insight}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Soft Skills */}
      {analysis.softSkillsObserved.length > 0 && (
        <Card className="bg-gradient-card shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Soft Skills Demonstrated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analysis.softSkillsObserved.map((skill, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Red Flags */}
      {analysis.redFlags.length > 0 && (
        <Card className="bg-gradient-card shadow-soft border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Flag className="w-4 h-4" />
              Concerns Identified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.redFlags.map((flag, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                  {flag}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Follow-up Questions */}
      {analysis.followUpQuestions.length > 0 && (
        <Card className="bg-gradient-card shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Suggested Follow-up Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.followUpQuestions.map((question, idx) => (
                <li key={idx} className="text-sm p-2 bg-primary/5 rounded">
                  <span className="font-medium">Q{idx + 1}:</span> {question}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Overall Assessment */}
      <Card className="bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Overall Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {analysis.overallAssessment}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};