'use client';

import { useEffect } from 'react';
import { Room, Track } from 'livekit-client';
import { GameState, GameStage } from '@/types/game';
import AudioRecorder from './AudioRecorder';

interface GameUIProps {
  gameState: GameState;
  identity: string;
  room: Room | null;
  onBuzzIn: () => void;
  onAnswerSubmit: (audioBlob: Blob, transcript: string) => void;
  onFollowUpAnswerSubmit: (audioBlob: Blob, transcript: string, questionIndex: number) => void;
}

export default function GameUI({
  gameState,
  identity,
  room,
  onBuzzIn,
  onAnswerSubmit,
  onFollowUpAnswerSubmit,
}: GameUIProps) {
  const isMyTurn = gameState.currentAnswerer === identity;
  const currentPlayer = gameState.players.get(identity);

  // Handle video stream attachment for answering stage
  useEffect(() => {
    if (gameState.stage !== GameStage.ANSWERING || !room) return;

    console.log('Setting up video stream, isMyTurn:', isMyTurn);
    
    if (isMyTurn) {
      // Attach local video for the answerer
      const localVideoElement = document.getElementById('answerer-local-video') as HTMLVideoElement;
      console.log('Local video element found:', !!localVideoElement);
      
      if (!localVideoElement) return;

      // Check if camera is already enabled
      const existingPublication = room.localParticipant.getTrackPublication(Track.Source.Camera);
      
      if (existingPublication && existingPublication.track) {
        // Camera already enabled, just attach
        existingPublication.track.attach(localVideoElement);
        console.log('Attached existing camera track');
      } else {
        // Need to enable camera - use browser getUserMedia directly
        console.log('Camera not found, getting media stream directly...');
        
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          .then(async (stream) => {
            console.log('Got media stream, creating track...');
            
            // Attach stream directly to video element first
            localVideoElement.srcObject = stream;
            localVideoElement.play();
            console.log('Video stream attached to element');
            
            // Then publish to LiveKit
            try {
              const videoTrack = stream.getVideoTracks()[0];
              await room.localParticipant.publishTrack(videoTrack, {
                source: Track.Source.Camera,
              });
              console.log('Video track published to LiveKit');
            } catch (publishError) {
              console.warn('Could not publish to LiveKit (insufficient permissions), but local video works:', publishError);
              // Video still shows locally even if we can't publish
            }
          })
          .catch(err => {
            console.error('Failed to get camera access:', err);
          });
      }
    } else {
      // Attach remote video for viewers
      const remoteVideoElement = document.getElementById('answerer-remote-video') as HTMLVideoElement;
      if (!remoteVideoElement || !gameState.currentAnswerer) return;

      // Find the remote participant
      const remoteParticipant = Array.from(room.remoteParticipants.values()).find(
        (p) => p.identity === gameState.currentAnswerer
      );
      
      if (remoteParticipant) {
        const cameraPublication = remoteParticipant.getTrackPublication(Track.Source.Camera);
        
        if (cameraPublication && cameraPublication.track) {
          cameraPublication.track.attach(remoteVideoElement);
          console.log('Attached remote video for viewer');
        } else {
          console.log('Waiting for remote video track, setting up listener...');
          
          // Listen for remote track subscribed
          const handleTrackSubscribed = (track: any) => {
            console.log('Remote track subscribed:', track.source, track.kind);
            if (track.source === Track.Source.Camera) {
              track.attach(remoteVideoElement);
              console.log('Attached remote camera track');
            }
          };

          remoteParticipant.on('trackSubscribed', handleTrackSubscribed);

          return () => {
            remoteParticipant.off('trackSubscribed', handleTrackSubscribed);
          };
        }
      }
    }

    return () => {
      // Cleanup: stop video streams
      const localVideoElement = document.getElementById('answerer-local-video') as HTMLVideoElement;
      const remoteVideoElement = document.getElementById('answerer-remote-video') as HTMLVideoElement;
      
      if (localVideoElement && isMyTurn) {
        // Stop all tracks in the stream
        if (localVideoElement.srcObject) {
          const stream = localVideoElement.srcObject as MediaStream;
          stream.getTracks().forEach(track => {
            track.stop();
            console.log('Stopped video track');
          });
          localVideoElement.srcObject = null;
        }
        
        // Also try LiveKit cleanup
        const cameraPublication = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (cameraPublication && cameraPublication.track) {
          cameraPublication.track.detach(localVideoElement);
        }
      }
      
      if (remoteVideoElement && !isMyTurn && gameState.currentAnswerer) {
        const remoteParticipant = Array.from(room.remoteParticipants.values()).find(
          (p) => p.identity === gameState.currentAnswerer
        );
        if (remoteParticipant) {
          const cameraPublication = remoteParticipant.getTrackPublication(Track.Source.Camera);
          if (cameraPublication && cameraPublication.track) {
            cameraPublication.track.detach(remoteVideoElement);
          }
        }
      }
    };
  }, [gameState.stage, gameState.currentAnswerer, isMyTurn, room]);

  if (!gameState.isGameActive) {
    return null;
  }

  return (
    <div className="absolute inset-0 bg-black bg-opacity-90 z-10 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full space-y-6">
        
        {/* Player Score Display */}
        <div className="border border-gray-700 p-4">
          <div className="flex justify-between items-center">
            <div className="text-gray-400 text-sm">
              Players: {gameState.players.size}
            </div>
            <div className="text-white text-sm">
              Your Score: <span className="font-mono text-lg">{currentPlayer?.score || 0}</span>
            </div>
          </div>
        </div>

        {/* Game Stage: Waiting */}
        {gameState.stage === GameStage.WAITING && (
          <div className="text-center text-white space-y-4">
            <h2 className="text-2xl font-light tracking-wide">Explain Arena</h2>
            <p className="text-gray-400">Waiting for question...</p>
          </div>
        )}

        {/* Game Stage: Question Display */}
        {gameState.stage === GameStage.QUESTION_DISPLAY && gameState.currentQuestion && (
          <div className="border border-white p-8 space-y-6">
            <div className="text-center">
              <div className="text-gray-400 text-xs mb-2">Topic: {gameState.currentQuestion.topicName}</div>
              <h3 className="text-white text-xl font-light leading-relaxed">
                {gameState.currentQuestion.content}
              </h3>
            </div>
            
            {gameState.countdown > 0 && (
              <div className="text-center">
                <div className="relative inline-block">
                  <div className="text-white text-8xl font-mono font-bold animate-pulse">
                    {gameState.countdown}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div 
                      className="absolute w-32 h-32 border-4 border-yellow-500 rounded-full animate-ping"
                      style={{ animationDuration: '1s' }}
                    ></div>
                  </div>
                </div>
                <p className="text-gray-300 text-lg mt-6 tracking-wide">Get ready to buzz in...</p>
              </div>
            )}
          </div>
        )}

        {/* Game Stage: Buzzing */}
        {gameState.stage === GameStage.BUZZING && gameState.currentQuestion && (
          <div className="border border-white p-8 space-y-6">
            <div className="text-center">
              <div className="text-gray-400 text-xs mb-2">Topic: {gameState.currentQuestion.topicName}</div>
              <h3 className="text-white text-lg font-light leading-relaxed mb-6">
                {gameState.currentQuestion.content}
              </h3>
            </div>

            <div className="text-center space-y-4">
              <button
                onClick={onBuzzIn}
                className="border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all duration-200 px-12 py-4 text-lg font-bold"
              >
                BUZZ IN
              </button>

              {gameState.buzzAttempts.length > 0 && (
                <div className="text-gray-400 text-sm">
                  {gameState.buzzAttempts.length} player(s) buzzed in...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Game Stage: Answering */}
        {gameState.stage === GameStage.ANSWERING && gameState.currentQuestion && (
          <div className="border border-white p-8 space-y-6">
            <div className="text-center">
              <div className="text-gray-400 text-xs mb-2">Topic: {gameState.currentQuestion.topicName}</div>
              <h3 className="text-white text-lg font-light leading-relaxed">
                {gameState.currentQuestion.content}
              </h3>
            </div>

            {/* Video Display Area */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-2xl aspect-video bg-black border border-gray-700">
                {isMyTurn ? (
                  <>
                    <video
                      id="answerer-local-video"
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 text-xs font-medium">
                      LIVE - You
                    </div>
                  </>
                ) : (
                  <>
                    <video
                      id="answerer-remote-video"
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 text-xs font-medium">
                      LIVE - {gameState.currentAnswerer}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-gray-700 pt-6">
              {isMyTurn ? (
                <div className="space-y-4">
                  <p className="text-white text-center text-sm">Your turn to answer (90 seconds)</p>
                  <AudioRecorder
                    maxDuration={90}
                    onRecordingComplete={onAnswerSubmit}
                    autoStart={true}
                    label="Start Answer"
                  />
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <p>{gameState.currentAnswerer} is answering...</p>
                  {gameState.countdown > 0 && (
                    <div className="text-white text-3xl font-mono mt-4">
                      {gameState.countdown}s
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Game Stage: AI Follow-up */}
        {gameState.stage === GameStage.AI_FOLLOWUP && (
          <div className="border border-white p-8 space-y-6">
            <div className="text-center">
              <h3 className="text-white text-lg mb-4">AI Follow-up Questions</h3>
            </div>

            {gameState.followUpQuestions.length === 0 ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white mx-auto mb-4"></div>
                <p className="text-gray-400 text-sm">AI is analyzing your answer...</p>
              </div>
            ) : (
              <div className="space-y-8">
                {gameState.followUpQuestions.map((fq, index) => (
                  <div key={index} className="border border-gray-700 p-6 space-y-4">
                    <div>
                      <div className="text-gray-400 text-xs mb-2">Follow-up {index + 1}</div>
                      <p className="text-white text-base">{fq.question}</p>
                    </div>

                    {isMyTurn && !gameState.followUpAnswers[index] ? (
                      <div className="space-y-2">
                        <p className="text-gray-400 text-xs text-center">
                          Click to record your 30-second response
                        </p>
                        <AudioRecorder
                          maxDuration={30}
                          onRecordingComplete={(blob, transcript) => {
                            console.log('Follow-up answer completed:', index, transcript.substring(0, 50));
                            onFollowUpAnswerSubmit(blob, transcript, index);
                          }}
                          onError={(error) => {
                            console.error('Follow-up recording error:', error);
                            alert(error);
                          }}
                          autoStart={false}
                          label="Record Answer (30s)"
                        />
                      </div>
                    ) : gameState.followUpAnswers[index] ? (
                      <div className="text-green-500 text-sm">Answer submitted</div>
                    ) : (
                      <div className="text-gray-400 text-sm">
                        {gameState.currentAnswerer} is answering...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Game Stage: Scoring */}
        {gameState.stage === GameStage.SCORING && gameState.finalScore && (
          <div className="border border-white p-8 space-y-6">
            <div className="text-center">
              <h3 className="text-white text-2xl mb-2">Final Score</h3>
              <div className="text-yellow-500 text-5xl font-mono">
                {gameState.finalScore.totalScore} / {gameState.finalScore.totalMaxScore}
              </div>
            </div>

            <div className="space-y-4">
              {gameState.finalScore.dimensions.map((dim, index) => (
                <div key={index} className="border border-gray-700 p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white text-sm">{dim.name}</span>
                    <span className="text-white font-mono">
                      {dim.score} / {dim.maxScore}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 h-2 rounded">
                    <div 
                      className="bg-white h-2 rounded transition-all duration-500"
                      style={{ width: `${(dim.score / dim.maxScore) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-gray-400 text-xs mt-2">{dim.feedback}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-700 pt-6">
              <p className="text-white text-sm leading-relaxed">
                {gameState.finalScore.overallFeedback}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

