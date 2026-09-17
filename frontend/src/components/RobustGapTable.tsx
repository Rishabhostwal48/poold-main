/**
 * Enhanced gap analysis table using robust matching
 * Shows requirement coverage with evidence from CV and interview
 */

import React from 'react';
import { CheckCircle2, AlertCircle, Plus, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { RobustGapAnalysis, GapCoverage } from '@/lib/gap';

interface RobustGapTableProps {
  gapAnalysis: RobustGapAnalysis;
  onAddEvidence?: (requirement: string) => void;
  className?: string;
}

export function RobustGapTable({ 
  gapAnalysis, 
  onAddEvidence,
  className = "" 
}: RobustGapTableProps) {
  
  const getCoverageIcon = (coverage: GapCoverage) => {
    switch (coverage) {
      case 'covered':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'weak':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      default:
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };
  
  const getCoverageBadge = (coverage: GapCoverage, score: number) => {
    const variants = {
      covered: 'default',
      weak: 'secondary',
      unknown: 'destructive'
    } as const;
    
    const labels = {
      covered: `Covered (${Math.round(score * 100)}%)`,
      weak: `Weak (${Math.round(score * 100)}%)`,
      unknown: 'Unknown'
    };
    
    return (
      <Badge variant={variants[coverage]} className="text-xs">
        {labels[coverage]}
      </Badge>
    );
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'CV':
        return '📄';
      case 'Interview':
        return '🎤';
      case 'JD':
        return '📋';
      default:
        return '📝';
    }
  };

  const { summary } = gapAnalysis;
  const totalRequirements = summary.covered + summary.weak + summary.unknown;
  const coveragePercent = totalRequirements > 0 
    ? Math.round(((summary.covered * 1.0 + summary.weak * 0.5) / totalRequirements) * 100) 
    : 0;

  return (
    <Card className={`bg-gradient-card shadow-soft ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Enhanced Gap Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {summary.covered + summary.weak}/{totalRequirements} Requirements
            </Badge>
            <Badge 
              variant={coveragePercent >= 80 ? 'default' : coveragePercent >= 60 ? 'secondary' : 'destructive'}
              className="text-xs"
            >
              {coveragePercent}% Coverage
            </Badge>
          </div>
        </div>
        
        {/* Coverage Progress */}
        <div className="space-y-2">
          <Progress value={coveragePercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Coverage: {summary.covered} strong, {summary.weak} partial, {summary.unknown} missing</span>
            <span>{coveragePercent}% overall</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {gapAnalysis.items.map((item, index) => {
            const isNiceToHave = item.requirement.startsWith('(nice)');
            
            return (
              <div
                key={index}
                className={`
                  p-4 rounded-lg border transition-smooth
                  ${!isNiceToHave 
                    ? 'border-primary/20 bg-primary/5' 
                    : 'border-muted bg-muted/30'
                  }
                  ${item.coverage === 'covered' ? 'ring-1 ring-success/30' : ''}
                `}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getCoverageIcon(item.coverage)}
                      <Badge 
                        variant={!isNiceToHave ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {!isNiceToHave ? 'Required' : 'Nice-to-have'}
                      </Badge>
                      {getCoverageBadge(item.coverage, item.score)}
                    </div>
                    
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {item.requirement}
                    </p>
                    
                    {item.evidence.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Evidence ({item.evidence.length} sources):
                        </p>
                        {item.evidence.map((evidence, evIndex) => (
                          <div 
                            key={evIndex} 
                            className={`text-xs p-3 rounded border-l-3 ${
                              evidence.score > 0.6 
                                ? 'bg-success/10 border-success/40' 
                                : evidence.score > 0.35 
                                ? 'bg-warning/10 border-warning/40' 
                                : 'bg-muted/50 border-muted'
                            }`}
                          >
                            <div className="flex items-start gap-2 mb-1">
                              <span className="text-xs">
                                {getSourceIcon(evidence.source)} {evidence.source}
                              </span>
                              {evidence.where && (
                                <span className="text-muted-foreground text-xs">
                                  • {evidence.where}
                                </span>
                              )}
                              <span className={`text-xs font-medium ml-auto ${
                                evidence.score > 0.6 ? 'text-success' : 
                                evidence.score > 0.35 ? 'text-warning' : 'text-muted-foreground'
                              }`}>
                                {Math.round(evidence.score * 100)}%
                              </span>
                            </div>
                            <p className="text-foreground leading-relaxed">
                              "{evidence.quote}"
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {item.evidence.length === 0 && (
                      <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                        No evidence found. Consider asking specific questions about this requirement.
                      </div>
                    )}
                  </div>
                  
                  {onAddEvidence && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAddEvidence(item.requirement)}
                            className="shrink-0"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Add evidence for this requirement</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {gapAnalysis.items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No requirements to analyze</p>
            <p className="text-sm">Upload a CV and job description to see enhanced gap analysis</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}