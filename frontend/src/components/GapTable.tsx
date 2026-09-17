/**
 * Gap analysis table showing requirement coverage
 * Displays must-have vs nice-to-have requirements with evidence status
 */

import React from 'react';
import { CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { GapAnalysis, JobProfile, Evidence } from '../types';

interface GapTableProps {
  jobProfile: JobProfile;
  gapAnalysis?: GapAnalysis;
  evidence: Record<string, Evidence[]>;
  onAddEvidence?: (requirement: string) => void;
  className?: string;
}

export function GapTable({ 
  jobProfile, 
  gapAnalysis, 
  evidence, 
  onAddEvidence,
  className = "" 
}: GapTableProps) {
  
  const getRequirementStatus = (requirement: string) => {
    const evidenceCount = evidence[requirement]?.length || 0;
    const gapStatus = gapAnalysis?.coverage[requirement];
    
    if (evidenceCount >= 2) return 'covered';
    if (evidenceCount === 1) return 'partial';
    if (gapStatus === 'covered') return 'covered';
    return 'unknown';
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'covered':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      default:
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };
  
  const getStatusBadge = (status: string) => {
    const variants = {
      covered: 'default',
      partial: 'secondary',
      unknown: 'destructive'
    } as const;
    
    const labels = {
      covered: 'Covered',
      partial: 'Partial',
      unknown: 'Unknown'
    };
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'destructive'} className="text-xs">
        {labels[status as keyof typeof labels] || 'Unknown'}
      </Badge>
    );
  };
  
  const getAllRequirements = () => {
    const mustHaves = jobProfile.must_haves.map(req => ({ 
      requirement: req, 
      type: 'must-have' as const 
    }));
    const niceToHaves = jobProfile.nice_haves.map(req => ({ 
      requirement: req, 
      type: 'nice-to-have' as const 
    }));
    
    return [...mustHaves, ...niceToHaves];
  };
  
  const requirements = getAllRequirements();
  const mustHaveCount = jobProfile.must_haves.length;
  const coveredMustHaves = jobProfile.must_haves.filter(req => 
    getRequirementStatus(req) === 'covered'
  ).length;
  const coveragePercent = mustHaveCount > 0 ? Math.round((coveredMustHaves / mustHaveCount) * 100) : 0;
  
  return (
    <Card className={`bg-gradient-card shadow-soft ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Gap Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {coveredMustHaves}/{mustHaveCount} Must-haves
            </Badge>
            <Badge 
              variant={coveragePercent >= 80 ? 'default' : coveragePercent >= 60 ? 'secondary' : 'destructive'}
              className="text-xs"
            >
              {coveragePercent}% Coverage
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requirements.map(({ requirement, type }, index) => {
            const status = getRequirementStatus(requirement);
            const evidenceCount = evidence[requirement]?.length || 0;
            
            return (
              <div
                key={index}
                className={`
                  p-4 rounded-lg border transition-smooth
                  ${type === 'must-have' 
                    ? 'border-primary/20 bg-primary/5' 
                    : 'border-muted bg-muted/30'
                  }
                  ${status === 'covered' ? 'ring-1 ring-success/30' : ''}
                `}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <Badge 
                        variant={type === 'must-have' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {type === 'must-have' ? 'Required' : 'Nice-to-have'}
                      </Badge>
                      {getStatusBadge(status)}
                    </div>
                    
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {requirement}
                    </p>
                    
                    {evidenceCount > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Evidence ({evidenceCount} points):
                        </p>
                        {evidence[requirement]?.slice(0, 2).map((ev, evIndex) => (
                          <div key={evIndex} className="text-xs p-2 bg-success/10 rounded border-l-2 border-success/30">
                            <span className="text-success-foreground">"{ev.quote}"</span>
                            <span className="text-muted-foreground ml-2">
                              @ {ev.timestamp}
                            </span>
                          </div>
                        ))}
                        {evidenceCount > 2 && (
                          <p className="text-xs text-muted-foreground">
                            +{evidenceCount - 2} more evidence points
                          </p>
                        )}
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
                            onClick={() => onAddEvidence(requirement)}
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
        
        {requirements.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No requirements to analyze</p>
            <p className="text-sm">Upload a job description to see gap analysis</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}