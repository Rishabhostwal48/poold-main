/**
 * VU (Volume Unit) meter for audio level visualization
 * Shows real-time audio input levels during recording
 */

import React from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VUMeterProps {
  volume: number; // 0-100
  isRecording: boolean;
  isConnected: boolean;
  className?: string;
}

export function VUMeter({ volume, isRecording, isConnected, className = "" }: VUMeterProps) {
  // Generate array of bars for visualization
  const bars = Array.from({ length: 12 }, (_, index) => {
    const threshold = (index + 1) * (100 / 12);
    const isActive = volume >= threshold;
    
    // Color based on level
    let barClass = "vu-bar inactive";
    if (isActive && isRecording) {
      if (index >= 9) barClass = "vu-bar recording"; // Red zone (75%+)
      else if (index >= 6) barClass = "vu-bar"; // Yellow zone (50%+)
      else barClass = "vu-bar active"; // Green zone (0-50%)
    }
    
    return (
      <div
        key={index}
        className={`${barClass} h-full w-1.5`}
        style={{
          height: `${20 + (index * 6)}px`, // Variable heights
          opacity: isActive ? 1 : 0.3
        }}
      />
    );
  });
  
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Microphone Icon */}
      <div className={`
        p-2 rounded-full transition-smooth
        ${isRecording 
          ? 'bg-audio-recording text-white animate-pulse' 
          : isConnected 
          ? 'bg-audio-active text-white' 
          : 'bg-muted text-muted-foreground'
        }
      `}>
        {isConnected ? (
          <Mic className="w-4 h-4" />
        ) : (
          <MicOff className="w-4 h-4" />
        )}
      </div>
      
      {/* VU Bars */}
      <div className="flex items-end gap-0.5 h-12 w-24">
        {bars}
      </div>
      
      {/* Volume Percentage */}
      <div className="text-xs font-mono text-muted-foreground min-w-12">
        {isRecording ? `${volume}%` : '--'}
      </div>
      
      {/* Status Indicator */}
      <div className="flex flex-col items-center gap-1">
        <div className={`
          w-2 h-2 rounded-full transition-smooth
          ${isRecording 
            ? 'bg-audio-recording animate-pulse' 
            : isConnected 
            ? 'bg-audio-active' 
            : 'bg-muted'
          }
        `} />
        <span className={`
          text-xs font-medium transition-smooth
          ${isRecording 
            ? 'text-audio-recording' 
            : isConnected 
            ? 'text-audio-active' 
            : 'text-muted-foreground'
          }
        `}>
          {isRecording ? 'REC' : isConnected ? 'LIVE' : 'OFF'}
        </span>
      </div>
    </div>
  );
}