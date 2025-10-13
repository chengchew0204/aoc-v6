'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  LocalParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  ConnectionState,
} from 'livekit-client';
import { useGameState } from '@/hooks/useGameState';
import GameUI from './GameUI';
import GameControlPanel from './GameControlPanel';

interface LiveKitRoomProps {
  roomName: string;
  identity: string;
  onDisconnected?: () => void;
}

export default function LiveKitRoom({ roomName, identity, onDisconnected }: LiveKitRoomProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<RemoteTrack | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<RemoteTrack | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [error, setError] = useState<string | null>(null);
  const [isGameMode, setIsGameMode] = useState(false);

  // Game state management
  const {
    gameState,
    startGame,
    generateQuestion,
    buzzIn,
    submitAnswer,
    submitFollowUpAnswer,
    nextRound,
  } = useGameState(room, identity);

  const connectToRoom = useCallback(async (canPublish = false) => {
    try {
      setError(null);
      
      // Get token from API
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity,
          roomName,
          canPublish,
          canSubscribe: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get access token');
      }

      const { token } = await response.json();

      // Connect to LiveKit room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: {
            width: 1280,
            height: 720,
          },
          facingMode: 'user',
        },
      });

      // Set up event listeners
      newRoom.on(RoomEvent.Connected, () => {
        console.log('Connected to room:', roomName);
        setIsConnected(true);
        setConnectionState(ConnectionState.Connected);
        setError(null); // Clear any previous errors
      });

      // Note: RoomEvent.Connecting doesn't exist in current LiveKit version
      // Connection state will be managed through Connected/Disconnected events

      newRoom.on(RoomEvent.Reconnecting, () => {
        console.log('Reconnecting to room:', roomName);
        setConnectionState(ConnectionState.Reconnecting);
      });

      newRoom.on(RoomEvent.Reconnected, () => {
        console.log('Reconnected to room:', roomName);
        setIsConnected(true);
        setConnectionState(ConnectionState.Connected);
        setError(null);
      });

      newRoom.on(RoomEvent.Disconnected, (reason) => {
        console.log('Disconnected from room:', reason);
        setIsConnected(false);
        setIsBroadcasting(false);
        setConnectionState(ConnectionState.Disconnected);
        setRemoteVideoTrack(null);
        setRemoteAudioTrack(null);
        // Only call onDisconnected for intentional disconnects, not connection errors
        // reason is DisconnectReason enum, not string
        onDisconnected?.();
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        console.log('Track subscribed:', track.kind, 'from', participant.identity);
        if (track.kind === Track.Kind.Video) {
          setRemoteVideoTrack(track);
        } else if (track.kind === Track.Kind.Audio) {
          setRemoteAudioTrack(track);
        }
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        console.log('Track unsubscribed:', track.kind, 'from', participant.identity);
        if (track.kind === Track.Kind.Video) {
          setRemoteVideoTrack(null);
        } else if (track.kind === Track.Kind.Audio) {
          setRemoteAudioTrack(null);
        }
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
        // If the broadcaster disconnected, clear the video and audio
        if (participant.identity !== identity) {
          setRemoteVideoTrack(null);
          setRemoteAudioTrack(null);
        }
      });

      // Handle track muted events (when someone's broadcast is taken over)
      newRoom.on(RoomEvent.TrackMuted, (publication, participant) => {
        console.log('Track muted:', publication.kind, 'from', participant.identity);
        if (participant.identity === identity && publication.kind === Track.Kind.Video) {
          // My video track was muted, I'm no longer broadcasting
          setIsBroadcasting(false);
          setError('Your broadcast has been taken over by another user');
        }
      });

      // Handle track unmuted events
      newRoom.on(RoomEvent.TrackUnmuted, (publication, participant) => {
        console.log('Track unmuted:', publication.kind, 'from', participant.identity);
      });

      // Connect to the room
      const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!livekitUrl) {
        throw new Error('NEXT_PUBLIC_LIVEKIT_URL environment variable is not set');
      }
      console.log('Connecting to LiveKit URL:', livekitUrl);
      await newRoom.connect(livekitUrl, token);

      // If this connection is for publishing, enable camera and microphone
      if (canPublish) {
        try {
          console.log('Enabling camera and microphone...');
          await newRoom.localParticipant.enableCameraAndMicrophone();
          setIsBroadcasting(true);
          console.log('Broadcasting started successfully');
        } catch (mediaErr) {
          console.error('Failed to enable media after connection:', mediaErr);
          setError('Unable to enable camera or microphone. Please check if devices are being used by other applications.');
        }
      }

      setRoom(newRoom);
    } catch (err) {
      console.error('Failed to connect to room:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to room');
    }
  }, [identity, roomName, onDisconnected]);

  const startBroadcasting = useCallback(async () => {
    try {
      setError(null);
      console.log('Starting broadcasting process...');
      
      // First, check if we can access media devices
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        // Stop the test stream immediately
        stream.getTracks().forEach(track => track.stop());
        console.log('Media devices access confirmed');
      } catch (mediaErr: any) {
        console.error('Media access denied:', mediaErr);
        let errorMessage = 'Media access failed: ';
        
        if (mediaErr.name === 'NotAllowedError') {
          errorMessage += 'Permission denied. Please click the camera icon in the browser address bar to allow access, then refresh the page.';
        } else if (mediaErr.name === 'NotFoundError') {
          errorMessage += 'Camera or microphone not found. Please ensure devices are connected.';
        } else if (mediaErr.name === 'NotReadableError') {
          errorMessage += 'Device is being used by another application. Please close other camera applications.';
        } else if (mediaErr.name === 'NotSecureError' || mediaErr.name === 'SecurityError') {
          errorMessage += 'Secure connection required (HTTPS). Please use localhost or HTTPS URL.';
        } else {
          errorMessage += mediaErr.message || 'Unknown error';
        }
        
        setError(errorMessage);
        return;
      }
      
      // Call takeover API to mute other broadcasters
      try {
        const response = await fetch('/api/takeover', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomName,
            newBroadcasterIdentity: identity,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to takeover broadcast');
        }
        
        console.log('Takeover successful');
      } catch (takeoverErr) {
        console.error('Takeover failed:', takeoverErr);
        // Continue anyway, as this might be the first broadcaster
      }

      // Disconnect current viewer connection and reconnect with publishing permissions
      if (room) {
        console.log('Disconnecting viewer connection to reconnect as broadcaster...');
        await room.disconnect();
        setRoom(null);
        setIsConnected(false);
      }

      // Connect with publishing permissions
      console.log('Connecting with publishing permissions...');
      await connectToRoom(true);
      
    } catch (err) {
      console.error('Failed to start broadcasting:', err);
      setError(err instanceof Error ? err.message : 'Failed to start broadcasting');
    }
  }, [room, roomName, identity, connectToRoom]);

  const stopBroadcasting = useCallback(async () => {
    if (room && room.localParticipant) {
      try {
        // Unpublish all tracks
        const cameraTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
        const micTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
        
        if (cameraTrack) {
          await room.localParticipant.unpublishTrack(cameraTrack);
        }
        if (micTrack) {
          await room.localParticipant.unpublishTrack(micTrack);
        }
        
        setIsBroadcasting(false);
        console.log('Broadcasting stopped');
        
        // Stop local media tracks to free up camera/microphone
        if (cameraTrack) {
          cameraTrack.stop();
        }
        if (micTrack) {
          micTrack.stop();
        }
        
        // Stay connected to the room as a viewer
        // No need to disconnect and reconnect
        
      } catch (error) {
        console.error('Error stopping broadcast:', error);
        setError('Failed to stop broadcasting');
      }
    }
  }, [room]);

  const disconnect = useCallback(async () => {
    if (room) {
      await room.disconnect();
      setRoom(null);
    }
  }, [room]);

  // Connect as viewer on component mount
  useEffect(() => {
    let mounted = true;
    
    const initConnection = async () => {
      if (mounted) {
        await connectToRoom(false);
      }
    };
    
    initConnection();
    
    return () => {
      mounted = false;
      if (room) {
        room.disconnect();
      }
    };
  }, [roomName, identity]); // Only depend on roomName and identity

  // Attach video track to element when available
  useEffect(() => {
    const videoElement = document.getElementById('remote-video') as HTMLVideoElement;
    if (videoElement && remoteVideoTrack) {
      remoteVideoTrack.attach(videoElement);
      return () => {
        remoteVideoTrack.detach();
      };
    }
  }, [remoteVideoTrack]);

  // Attach audio track to element when available
  useEffect(() => {
    const audioElement = document.getElementById('remote-audio') as HTMLAudioElement;
    if (audioElement && remoteAudioTrack) {
      remoteAudioTrack.attach(audioElement);
      return () => {
        remoteAudioTrack.detach();
      };
    }
  }, [remoteAudioTrack]);

  // Attach local video track when broadcasting
  useEffect(() => {
    const localVideoElement = document.getElementById('local-video') as HTMLVideoElement;
    if (localVideoElement && room && isBroadcasting) {
      const localVideoTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (localVideoTrack) {
        localVideoTrack.attach(localVideoElement);
        return () => {
          localVideoTrack.detach();
        };
      }
    }
  }, [room, isBroadcasting]);

  return (
    <div className="w-full h-screen bg-black relative">
      {/* Audio element for remote audio track */}
      <audio
        id="remote-audio"
        autoPlay
        playsInline
      />
      
      {/* Video Container */}
      <div className="video-container">
        {/* Remote Video (when someone else is broadcasting) */}
        {remoteVideoTrack && !isBroadcasting && (
          <video
            id="remote-video"
            autoPlay
            playsInline
            muted={false}
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Local Video (when I am broadcasting) */}
        {isBroadcasting && (
          <video
            id="local-video"
            autoPlay
            playsInline
            muted={true}
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Black Screen / Waiting State */}
        {!remoteVideoTrack && !isBroadcasting && (
          <div className="flex flex-col items-center justify-center h-full text-white">
            <div className="border border-gray-800 p-8 text-center">
              <h1 className="text-xl font-light mb-4 tracking-wide">Arena of Consciousness</h1>
              {connectionState === ConnectionState.Connected ? (
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm">No active broadcast</p>
                  <p className="text-xs text-gray-500">
                    {room && room.numParticipants > 1 
                      ? `${room.numParticipants} participants online` 
                      : 'You are the first participant'}
                  </p>
                  <p className="text-xs text-gray-300 mt-4">Click button below to start broadcasting</p>
                </div>
              ) : connectionState === ConnectionState.Reconnecting ? (
                <p className="text-gray-400 text-sm">Reconnecting...</p>
              ) : (
                <p className="text-gray-400 text-sm">Connecting...</p>
              )}
            </div>
          </div>
        )}
        
        {/* Connection Status */}
        <div className="absolute top-4 right-4 text-white">
          <div className={`inline-flex items-center px-3 py-1 text-xs border ${
            connectionState === ConnectionState.Connected 
              ? 'border-white text-white' 
              : connectionState === ConnectionState.Connecting
              ? 'border-gray-400 text-gray-400'
              : 'border-gray-600 text-gray-600'
          }`}>
            <div className={`w-1 h-1 rounded-full mr-2 ${
              connectionState === ConnectionState.Connected ? 'bg-white' : 'bg-gray-500'
            }`}></div>
            {connectionState === ConnectionState.Connected ? 'Connected' : 
             connectionState === ConnectionState.Connecting ? 'Connecting' : 'Disconnected'}
          </div>
        </div>
        
        {/* Participant Count */}
        {room && (
          <div className="absolute bottom-4 right-4 text-white text-xs">
            {room.numParticipants} online
          </div>
        )}
        
        {/* Broadcasting Status */}
        {(isBroadcasting || (remoteVideoTrack && !isBroadcasting)) && (
          <div className="absolute bottom-4 left-4 text-white text-xs">
            {isBroadcasting && "Broadcasting"}
            {remoteVideoTrack && !isBroadcasting && "Viewing"}
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="control-panel">
        {!isBroadcasting ? (
          <button
            onClick={startBroadcasting}
            disabled={!isConnected}
            className="border border-white text-white hover:bg-white hover:text-black disabled:border-gray-600 disabled:text-gray-600 disabled:hover:bg-transparent disabled:hover:text-gray-600 px-6 py-2 text-sm transition-colors duration-200"
          >
            {remoteVideoTrack ? 'Takeover Broadcast' : 'Start Broadcasting'}
          </button>
        ) : (
          <button
            onClick={stopBroadcasting}
            className="border border-gray-400 text-gray-400 hover:border-white hover:text-white px-6 py-2 text-sm transition-colors duration-200"
          >
            Stop Broadcasting
          </button>
        )}
        
        {isConnected && (
          <>
            <button
              onClick={() => setIsGameMode(!isGameMode)}
              className={`border ${isGameMode ? 'border-green-500 text-green-500' : 'border-gray-600 text-gray-600'} hover:border-green-400 hover:text-green-400 px-6 py-2 text-sm transition-colors duration-200`}
            >
              {isGameMode ? 'Game Mode: ON' : 'Game Mode: OFF'}
            </button>
            
            <button
              onClick={disconnect}
              className="border border-gray-600 text-gray-600 hover:border-gray-400 hover:text-gray-400 px-6 py-2 text-sm transition-colors duration-200"
            >
              Disconnect
            </button>
          </>
        )}
      </div>

      {/* Game UI Overlay */}
      {isGameMode && (
        <>
          <GameControlPanel
            gameState={gameState}
            onStartGame={startGame}
            onGenerateQuestion={generateQuestion}
            onNextRound={nextRound}
          />
          
          <GameUI
            gameState={gameState}
            identity={identity}
            room={room}
            onBuzzIn={buzzIn}
            onAnswerSubmit={submitAnswer}
            onFollowUpAnswerSubmit={submitFollowUpAnswer}
          />
        </>
      )}
      
      {/* Error/Info Display */}
      {error && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border border-gray-400 bg-black p-6 max-w-md text-white">
          <h3 className="font-medium mb-3 text-sm">
            {error.includes('taken over') ? 'Notification' : 'Error'}
          </h3>
          <p className="text-sm text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => setError(null)}
            className="border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white px-4 py-1 text-xs transition-colors duration-200"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
