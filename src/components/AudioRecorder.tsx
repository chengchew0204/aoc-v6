'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface AudioRecorderProps {
  maxDuration: number; // in seconds
  onRecordingComplete: (audioBlob: Blob, transcript: string) => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
  label?: string;
}

export default function AudioRecorder({ 
  maxDuration, 
  onRecordingComplete, 
  onError,
  autoStart = false,
  label = 'Record Answer'
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  const [recordingStarted, setRecordingStarted] = useState(false);
  const [buttonClicked, setButtonClicked] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    console.log('startRecording called');
    setButtonClicked(true);
    
    try {
      chunksRef.current = [];
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');
      streamRef.current = stream;

      // Try different audio formats for better compatibility with Whisper API
      let mimeType = 'audio/webm;codecs=opus';
      let useAudioContext = false;
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Fallback to any supported format
        mimeType = '';
        useAudioContext = true;
      }
      
      console.log('Using mime type:', mimeType);
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        
        // Create blob with actual mime type
        const actualMimeType = mimeType || mediaRecorder.mimeType;
        const audioBlob = new Blob(chunksRef.current, { type: actualMimeType });
        
        console.log('Audio blob created:', {
          size: audioBlob.size,
          type: audioBlob.type,
          chunks: chunksRef.current.length
        });
        
        // Upload to transcribe API
        try {
          const formData = new FormData();
          // Determine file extension based on mime type
          let extension = 'webm';
          if (actualMimeType.includes('mp4') || actualMimeType.includes('m4a')) {
            extension = 'm4a';
          } else if (actualMimeType.includes('ogg')) {
            extension = 'ogg';
          }
          
          console.log('Uploading audio as:', `recording.${extension}`);
          formData.append('audio', audioBlob, `recording.${extension}`);

          const response = await fetch('/api/game/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Transcription failed');
          }

          const { transcript } = await response.json();
          onRecordingComplete(audioBlob, transcript);
        } catch (error) {
          console.error('Transcription error:', error);
          onError?.('Failed to transcribe audio. Please try again.');
        } finally {
          setIsProcessing(false);
          setRecordingStarted(false);
          setTimeLeft(maxDuration);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStarted(true);
      setTimeLeft(maxDuration);
      setButtonClicked(false); // Reset button state once recording starts
      console.log('Recording started successfully');

      // Start countdown timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      setButtonClicked(false);
      onError?.('Failed to access microphone. Please check permissions.');
    }
  }, [maxDuration, onRecordingComplete, onError, stopRecording]);

  useEffect(() => {
    if (autoStart && !recordingStarted) {
      startRecording();
    }
  }, [autoStart, recordingStarted, startRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {!recordingStarted && !isProcessing && (
        <button
          onClick={() => {
            console.log('AudioRecorder button clicked!');
            startRecording();
          }}
          disabled={buttonClicked && !isRecording}
          className="border border-white text-white hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-wait transition-colors duration-200 px-8 py-3 text-sm"
        >
          {buttonClicked && !isRecording ? 'Starting...' : label}
        </button>
      )}

      {isRecording && (
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm">Recording...</span>
          </div>
          
          <div className="text-white text-3xl font-mono">
            {formatTime(timeLeft)}
          </div>

          <button
            onClick={stopRecording}
            className="border border-gray-400 text-gray-400 hover:border-white hover:text-white transition-colors duration-200 px-6 py-2 text-sm"
          >
            Stop Recording
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white mx-auto"></div>
          <p className="text-white text-sm">Processing audio...</p>
        </div>
      )}
    </div>
  );
}

