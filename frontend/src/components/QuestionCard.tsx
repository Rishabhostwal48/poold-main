/**
 * Question display card for interview sessions
 * Shows current question, expected signals, and follow-up hints
 */

import React from 'react';
import { MessageSquare, Target, Info, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { InterviewQuestion, InterviewStage } from '../types';

interface QuestionCardProps {
  question: InterviewQuestion | null;
  stage: InterviewStage;
  isWaitingForResponse?: boolean;
  className?: string;
}

const stageLabels = {
  intro: 'Introduction',
  background: 'Background',
  competency: 'Competency Assessment',
  deep_dive: 'Deep Dive',
  behavioral: 'Behavioral Questions',
  closing: 'Closing'
};

const stageColors = {
  intro: 'bg-primary/10 text-primary',
  background: 'bg-accent/10 text-accent',
  competency: 'bg-success/10 text-success',
  deep_dive: 'bg-warning/10 text-warning',
  behavioral: 'bg-purple-100 text-purple-700',
  closing: 'bg-muted text-muted-foreground'
};

export function QuestionCard({ 
  question, 
  stage, 
  isWaitingForResponse = false,
  className = "" 
}: QuestionCardProps) {
  
  if (!question) {
    return (
      <Card className={`bg-gradient-card shadow-soft ${className}`}>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium text-muted-foreground">Waiting for question...</h3>
              <p className="text-sm text-muted-foreground/70">
                The AI interviewer is preparing the next question
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <TooltipProvider>
      <Card className={`bg-gradient-card shadow-medium border-primary/20 ${className}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Current Question
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={`text-xs ${stageColors[stage]}`}
              >
                <Clock className="w-3 h-3 mr-1" />
                {stageLabels[stage]}
              </Badge>
              
              {isWaitingForResponse && (
                <Badge variant="secondary" className="animate-pulse">
                  Listening...
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Main Question */}
          <div className="p-6 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-lg font-medium text-primary-foreground leading-relaxed">
              {question.question}
            </p>
          </div>
          
          {/* Expected Signals */}
          {question.expected_signals && question.expected_signals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" />
                <h4 className="font-medium text-sm">Expected Signals</h4>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Key points to listen for in the candidate's response</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {question.expected_signals.map((signal, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary"
                    className="text-xs bg-accent/10 text-accent-foreground"
                  >
                    {signal}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Follow-up Hint */}
          {question.if_short_followup && (
            <div className="p-4 bg-warning/5 rounded-lg border border-warning/20">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <h5 className="font-medium text-warning text-sm mb-1">
                    If response is short:
                  </h5>
                  <p className="text-sm text-warning-foreground italic">
                    "{question.if_short_followup}"
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Tips for interviewer */}
          <div className="pt-4 border-t border-border/30">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Listen for specific examples, metrics, and the candidate's role in achievements. 
              Look for STAR method responses (Situation, Task, Action, Result).
            </p>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}