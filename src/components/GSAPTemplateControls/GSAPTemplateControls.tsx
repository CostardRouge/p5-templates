"use client";

import React from 'react';
import { Play, Pause, RotateCcw, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface GSAPTemplateControlsProps {
  isPlaying: boolean;
  progress: number;
  currentFrame: number;
  totalFrames: number;
  onPlayPause: () => void;
  onRestart: () => void;
  onSeek: (progress: number) => void;
  onRecord?: () => void;
  isRecording?: boolean;
}

export default function GSAPTemplateControls({
  isPlaying,
  progress,
  currentFrame,
  totalFrames,
  onPlayPause,
  onRestart,
  onSeek,
  onRecord,
  isRecording = false,
}: GSAPTemplateControlsProps) {
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4 min-w-[400px]">
      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={onPlayPause}
          disabled={isRecording}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        {/* Restart Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={onRestart}
          disabled={isRecording}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        {/* Progress Slider */}
        <div className="flex-1">
          <Slider
            value={[progress * 100]}
            onValueChange={([value]) => onSeek(value / 100)}
            max={100}
            step={1}
            disabled={isRecording}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Frame {currentFrame}</span>
            <span>{Math.round(progress * 100)}%</span>
            <span>{totalFrames} frames</span>
          </div>
        </div>

        {/* Record Button */}
        {onRecord && (
          <Button
            variant={isRecording ? 'destructive' : 'default'}
            onClick={onRecord}
            disabled={isRecording}
            className="gap-2"
          >
            <Video className="h-4 w-4" />
            {isRecording ? 'Recording...' : 'Record'}
          </Button>
        )}
      </div>
    </div>
  );
}
