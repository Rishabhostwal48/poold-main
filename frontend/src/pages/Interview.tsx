/**
 * Interview page - Live conversational AI interview
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Transcript } from '@/components/Transcript';
import { RobustGapTable } from '@/components/RobustGapTable';
import { useInterviewStore } from '@/store/interview';
import { computeGapAnalysis } from '@/lib/gap';
import LiveInterview from '@/components/LiveInterview';
import type { TranscriptItem } from '@/types';

export default function Interview() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [counter, setCounter] = useState(3);
  
  const {
    candidate,
    job,
    robustGap,
    transcript,
    evidence,
    notes,
    canProceedToInterview,
    updateNotes,
    getCoveragePercent,
    setRobustGap
  } = useInterviewStore();
  
  const [localNotes, setLocalNotes] = useState(notes);

  useEffect(() => {
    const interval = setInterval(() => {
      setCounter((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsLoading(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);
  const notesTimeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    if (!canProceedToInterview()) {
      navigate('/setup');
    }
  }, [canProceedToInterview, navigate]);

  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);
  
  const handleNotesChange = useCallback((value: string) => {
    setLocalNotes(value);
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }
    notesTimeoutRef.current = setTimeout(() => {
      updateNotes(value);
    }, 300);
  }, [updateNotes]);
  
  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (candidate && job && transcript.length > 0) {
      const transcriptItems = transcript.map(t => ({
        text: t.text,
        speaker: t.speaker,
        ts: t.ts
      }));
      
      const updatedGap = computeGapAnalysis({
        candidate,
        job,
        transcript: transcriptItems
      });
      
      setRobustGap(updatedGap);
    }
  }, [candidate, job, transcript, setRobustGap]);
  
  const handleInterviewComplete = () => {
    navigate('/summary');
  };
  
  const handleAddEvidence = (quote: string, timestamp: string, transcriptId: string) => {
    toast({
      title: "Evidence captured",
      description: "Quote saved for manual assignment to requirements",
    });
  };
  
  const coveragePercent = getCoveragePercent();

  return (
    <div className="min-h-screen bg-gradient-subtle relative">
      {isLoading && (
        <>
          <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50" />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="bg-background border rounded-lg shadow-lg p-6 max-w-md w-full mx-4 animate-in fade-in-0 zoom-in-95">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Starting Interview...
                  </h2>
                  <p className="text-muted-foreground">
                    Interview is starting in {counter} second{counter !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-secondary">
                  <div 
                    className="h-full bg-primary transition-all duration-300" 
                    style={{ width: `${((3 - counter) / 3) * 100}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <div className={cn(
        "container mx-auto px-6 py-6 max-w-7xl transition-opacity duration-300",
        isLoading ? "opacity-0" : "opacity-100"
      )}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/setup')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Setup
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Live AI Interview</h1>
              <p className="text-muted-foreground">
                {candidate?.basics?.name} • {job?.title}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-4">
            <div className="progress-step completed">1</div>
            <div className="w-12 h-1 bg-primary rounded" />
            <div className="progress-step completed">2</div>
            <div className="w-12 h-1 bg-primary rounded" />
            <div className="progress-step active">3</div>
            <div className="w-12 h-1 bg-muted rounded" />
            <div className="progress-step inactive">4</div>
          </div>
        </div>
        
        <div className="grid lg:grid-cols-1 gap-6">
          <div className="space-y-6">
            <LiveInterview onComplete={handleInterviewComplete} />
          </div>
          
          <div className="space-y-6">
            {/* <Tabs defaultValue="transcript" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
              
              <TabsContent value="transcript" className="mt-4">
                <Card className="bg-gradient-card shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Live Transcript</span>
                      <Badge variant="outline">
                        {transcript.length} messages
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-96">
                      <Transcript
                        transcript={transcript}
                        onAddEvidence={handleAddEvidence}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="evidence" className="mt-4">
                <div className="h-96 overflow-auto">
                  {job && robustGap && (
                    <RobustGapTable 
                      gapAnalysis={robustGap}
                      className="h-full"
                    />
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="notes" className="mt-4">
                <Card className="bg-gradient-card shadow-soft">
                  <CardHeader>
                    <CardTitle>Interview Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Add your notes about the candidate's responses, observations, and evidence..."
                      value={localNotes}
                      onChange={(e) => handleNotesChange(e.target.value)}
                      className="min-h-80 resize-none"
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs> */}

            {job && (
              <Card className="bg-gradient-card shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Interview Progress</span>
                    <Badge variant={coveragePercent >= 80 ? 'default' : 'secondary'}>
                      {coveragePercent}% Complete
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={coveragePercent} className="mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {job.must_haves.filter(req => (evidence[req]?.length || 0) >= 1).length} of {job.must_haves.length} requirements covered
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}