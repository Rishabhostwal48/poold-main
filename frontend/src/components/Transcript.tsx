/**
 * Real-time transcript display component
 * Shows conversation history with speaker identification and timestamps
 */

import React, { useEffect, useRef } from 'react';
import { Clock, Copy, Quote, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import type { TranscriptItem, Evidence } from '../types';

interface TranscriptProps {
  transcript: TranscriptItem[];
  onAddEvidence?: (quote: string, timestamp: string, transcriptId: string) => void;
  className?: string;
  autoScroll?: boolean;
}

export function Transcript({ 
  transcript, 
  onAddEvidence, 
  className = "",
  autoScroll = true
}: TranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript.length, autoScroll]);
  
  const handleCopyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "Message text copied successfully",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };
  
  const handleQuoteAsEvidence = (item: TranscriptItem) => {
    if (onAddEvidence) {
      // Take first 100 characters for evidence quote
      const quote = item.text.length > 100 
        ? item.text.substring(0, 100) + '...' 
        : item.text;
      
      onAddEvidence(quote, item.ts, item.id);
      
      toast({
        title: "Added to evidence",
        description: "Quote saved as evidence for manual assignment",
      });
    }
  };
  
  const formatTimestamp = (timestamp: string) => {
    try {
      // Handle both ISO strings and simple time formats
      if (timestamp.includes(':')) {
        return timestamp;
      }
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return timestamp;
    }
  };
  
  if (transcript.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
            <Clock className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium text-muted-foreground">No conversation yet</h3>
            <p className="text-sm text-muted-foreground/70">
              Start recording to begin the interview transcript
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <TooltipProvider>
      <ScrollArea className={`h-full ${className}`}>
        <div className="space-y-4 p-4">
          {transcript.map((item, index) => {
            const isInterviewer = item.speaker === 'interviewer';
            
            return (
              <div
                key={item.id}
                className={`flex gap-3 ${isInterviewer ? 'justify-start' : 'justify-end'}`}
              >
                {/* Avatar for interviewer */}
                {isInterviewer && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                
                {/* Message bubble */}
                <div className={`max-w-[80%] ${isInterviewer ? 'order-1' : 'order-2'}`}>
                  <div className={`message-bubble ${isInterviewer ? 'interviewer' : 'candidate'}`}>
                    {/* Message header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={isInterviewer ? 'default' : 'secondary'} 
                          className="text-xs"
                        >
                          {isInterviewer ? 'Interviewer' : 'Candidate'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(item.ts)}
                        </span>
                      </div>
                      
                      {/* Message actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleCopyMessage(item.text)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy message</TooltipContent>
                        </Tooltip>
                        
                        {!isInterviewer && onAddEvidence && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleQuoteAsEvidence(item)}
                              >
                                <Quote className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Quote as evidence</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    
                    {/* Message content */}
                    <p className="text-sm leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                </div>
                
                {/* Avatar for candidate */}
                {!isInterviewer && (
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-accent" />
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Scroll anchor */}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
    </TooltipProvider>
  );
}