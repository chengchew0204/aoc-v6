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
  onEnableCamera: () => Promise<boolean>;
  onDisableCamera: () => Promise<void>;
}

export default function GameUI({
  gameState,
  identity,
  room,
  onBuzzIn,
  onAnswerSubmit,
  onEnableCamera,
  onDisableCamera,
}: GameUIProps) {
  const isMyTurn = gameState.currentAnswerer === identity;
  const currentPlayer = gameState.players.get(identity);

  // Handle camera enable/disable for answering
  useEffect(() => {
    const isAnsweringStage = gameState.stage === GameStage.ANSWERING;
    
    if (!room) return;

    console.log('Video effect triggered:', { 
      stage: gameState.stage, 
      isMyTurn, 
      currentAnswerer: gameState.currentAnswerer 
    });

    // Enable camera ONLY when it's my turn to answer in ANSWERING stage
    if (isMyTurn && isAnsweringStage) {
      console.log('Enabling camera for answering...');
      onEnableCamera().then(success => {
        if (success) {
          console.log('Camera enabled successfully');
          
          // Attach to video element
          const localVideoElement = document.getElementById('answerer-local-video') as HTMLVideoElement;
          if (localVideoElement) {
            const cameraTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
            if (cameraTrack) {
              cameraTrack.attach(localVideoElement);
              console.log('Camera track attached to local video element');
            }
          }
        } else {
          console.error('Failed to enable camera');
        }
      });
    } else {
      // Disable camera in all other stages (WAITING, BUZZING, SCORING, GAME_OVER)
      // or when it's not my turn
      const cameraTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (cameraTrack && cameraTrack.isMuted === false) {
        console.log('Disabling camera - not in answering stage or not my turn');
        onDisableCamera();
        
        // Cleanup video element
        const localVideoElement = document.getElementById('answerer-local-video') as HTMLVideoElement;
        if (localVideoElement) {
          cameraTrack.detach(localVideoElement);
        }
      }
    }

    // Cleanup on unmount or stage change
    return () => {
      if (isMyTurn && isAnsweringStage) {
        console.log('Cleanup: Disabling camera after answering');
        onDisableCamera();
        
        // Cleanup video element
        const localVideoElement = document.getElementById('answerer-local-video') as HTMLVideoElement;
        if (localVideoElement) {
          const cameraTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
          if (cameraTrack) {
            cameraTrack.detach(localVideoElement);
          }
        }
      }
    };
  }, [gameState.stage, gameState.currentAnswerer, isMyTurn, room, onEnableCamera, onDisableCamera]);

  // Safety guard: Explicitly disable camera when entering non-answering stages
  useEffect(() => {
    if (!room) return;

    const nonAnsweringStages = [
      GameStage.WAITING,
      GameStage.BUZZING,
      GameStage.SCORING,
      GameStage.GAME_OVER
    ];

    if (nonAnsweringStages.includes(gameState.stage)) {
      const cameraTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (cameraTrack && cameraTrack.isMuted === false) {
        console.log(`Stage guard: Disabling camera in ${gameState.stage} stage`);
        onDisableCamera();
      }
    }
  }, [gameState.stage, room, onDisableCamera]);

  // Handle remote video attachment for viewers
  useEffect(() => {
    const isAnsweringStage = gameState.stage === GameStage.ANSWERING;
    
    if (!room || isMyTurn || !isAnsweringStage) return;

    const remoteVideoElement = document.getElementById('answerer-remote-video') as HTMLVideoElement;
    if (!remoteVideoElement || !gameState.currentAnswerer) return;

    console.log('Setting up remote video for viewer');

    // Find the remote participant who is answering
    const remoteParticipant = Array.from(room.remoteParticipants.values()).find(
      (p) => p.identity === gameState.currentAnswerer
    );
    
    if (!remoteParticipant) {
      console.log('Remote participant not found yet:', gameState.currentAnswerer);
      return;
    }

    // Attach existing camera track if available
    const cameraPublication = remoteParticipant.getTrackPublication(Track.Source.Camera);
    
    if (cameraPublication && cameraPublication.track) {
      cameraPublication.track.attach(remoteVideoElement);
      console.log('Attached remote camera track for viewer');
    } else {
      console.log('Waiting for remote camera track...');
      
      // Listen for when the track becomes available
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

    // Cleanup when stage changes
    return () => {
      const cameraTrack = remoteParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (cameraTrack) {
        cameraTrack.detach(remoteVideoElement);
        console.log('Detached remote camera track');
      }
    };
  }, [gameState.stage, gameState.currentAnswerer, isMyTurn, room, gameState.currentRound]);

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
              {gameState.isGameActive && gameState.currentRound > 0 && (
                <span className="ml-4 text-yellow-500">
                  Round {gameState.currentRound} / {gameState.totalRounds}
                </span>
              )}
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
                      key={`local-${gameState.currentAnswerer}-${gameState.currentRound}`}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 text-xs font-medium">
                      LIVE - You
                    </div>
                  </>
                ) : (
                  <>
                    <video
                      id="answerer-remote-video"
                      key={`remote-${gameState.currentAnswerer}-${gameState.currentRound}`}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover scale-x-[-1]"
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

        {/* Game Stage: Scoring - Loading */}
        {gameState.stage === GameStage.SCORING && !gameState.finalScore && (
          <div className="border border-white p-8 space-y-6">
            <div className="text-center">
              <h3 className="text-white text-2xl mb-4">Scoring Answer...</h3>
              <div className="flex justify-center items-center space-x-2">
                <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <p className="text-gray-400 text-sm mt-6">AI is evaluating the answer...</p>
            </div>
          </div>
        )}

        {/* Game Stage: Scoring - Results */}
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

        {/* Game Stage: Game Over */}
        {gameState.stage === GameStage.GAME_OVER && (
          <div className="border border-white p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-white text-3xl font-light tracking-wide mb-2">Game Over</h2>
              <p className="text-gray-400 text-sm">
                {gameState.totalRounds} rounds completed
              </p>
            </div>

            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-white text-xl mb-4 text-center">Final Leaderboard</h3>
              <div className="space-y-3">
                {Array.from(gameState.players.values())
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => {
                    const isCurrentUser = player.identity === identity;
                    const rank = index + 1;
                    const getRankSuffix = (n: number) => {
                      if (n === 1) return 'st';
                      if (n === 2) return 'nd';
                      if (n === 3) return 'rd';
                      return 'th';
                    };

                    return (
                      <div
                        key={player.identity}
                        className={`border p-4 flex justify-between items-center ${
                          isCurrentUser
                            ? 'border-yellow-500 bg-yellow-500 bg-opacity-10'
                            : 'border-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div
                            className={`text-2xl font-mono ${
                              rank === 1
                                ? 'text-yellow-500'
                                : rank === 2
                                ? 'text-gray-300'
                                : rank === 3
                                ? 'text-orange-600'
                                : 'text-gray-500'
                            }`}
                          >
                            {rank}
                            <span className="text-xs align-super">{getRankSuffix(rank)}</span>
                          </div>
                          <div>
                            <div className={`text-sm ${isCurrentUser ? 'text-yellow-500 font-medium' : 'text-white'}`}>
                              {player.identity}
                              {isCurrentUser && <span className="ml-2 text-xs">(You)</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-white text-xl font-mono">
                          {player.score}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="border-t border-gray-700 pt-6 text-center">
              <p className="text-gray-400 text-sm">
                Waiting for host to start a new game...
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

