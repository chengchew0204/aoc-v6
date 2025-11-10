'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Room } from 'livekit-client';
import {
  GameState,
  GameStage,
  GameMessageType,
  GameMessage,
  Question,
  Player,
  BuzzAttempt,
  Answer,
  FollowUpQuestion,
  FinalScore,
} from '@/types/game';

const BUZZ_COLLECTION_WINDOW = 200; // ms

export function useGameState(room: Room | null, identity: string) {
  const [gameState, setGameState] = useState<GameState>({
    stage: GameStage.WAITING,
    currentQuestion: null,
    currentAnswerer: null,
    buzzAttempts: [],
    players: new Map(),
    answer: null,
    followUpQuestions: [],
    followUpAnswers: [],
    finalScore: null,
    countdown: 0,
    isGameActive: false,
    currentContentId: null,
    currentRound: 0,
    totalRounds: 5,
  });

  const buzzCollectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const encoder = new TextEncoder();

  // Add player to game state
  const addPlayer = useCallback((playerIdentity: string) => {
    setGameState(prev => {
      if (prev.players.has(playerIdentity)) {
        return prev;
      }
      const newPlayers = new Map(prev.players);
      newPlayers.set(playerIdentity, {
        identity: playerIdentity,
        score: 0,
        isAnswering: false,
        hasAnswered: false,
      });
      console.log(`Player added: ${playerIdentity}, total players: ${newPlayers.size}`);
      return { ...prev, players: newPlayers };
    });
  }, []);

  // Send game message via Data Channel
  const sendGameMessage = useCallback((type: GameMessageType, payload?: any) => {
    if (!room) {
      console.warn('Cannot send game message: room is not initialized');
      return;
    }

    try {
      const message: GameMessage = {
        type,
        timestamp: Date.now(),
        sender: identity,
        payload,
      };

      const data = encoder.encode(JSON.stringify(message));
      
      console.log(`Sending game message: ${type}`, { 
        roomState: room.state,
        numParticipants: room.numParticipants,
        sender: identity 
      });
      
      // Send message via Data Channel
      room.localParticipant.publishData(data, { reliable: true })
        .then(() => {
          console.log(`Game message sent successfully: ${type}`);
        })
        .catch((error) => {
          console.error('Failed to send game message via Data Channel:', error);
          // Don't fail silently - this is important for multiplayer sync
        });
    } catch (error) {
      console.error('Error preparing game message:', error);
    }
  }, [room, identity, encoder]);

  // Start new game
  const startGame = useCallback((totalRounds: number = 5) => {
    sendGameMessage(GameMessageType.START_GAME);
    sendGameMessage(GameMessageType.CONFIGURE_ROUNDS, { totalRounds });
    
    // Ensure current player is registered
    addPlayer(identity);
    
    setGameState(prev => ({
      ...prev,
      isGameActive: true,
      stage: GameStage.WAITING,
      currentRound: 1,
      totalRounds,
    }));
  }, [sendGameMessage, identity, addPlayer]);

  // Set content ID
  const setContent = useCallback((contentId: string) => {
    sendGameMessage(GameMessageType.SET_CONTENT, { contentId });
    setGameState(prev => ({
      ...prev,
      currentContentId: contentId,
    }));
  }, [sendGameMessage]);

  // Generate and broadcast new question
  const generateQuestion = useCallback(async () => {
    try {
      console.log('Generating question with contentId:', gameState.currentContentId);
      const response = await fetch('/api/game/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          difficulty: 'medium',
          contentId: gameState.currentContentId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate question`);
      }

      const question: Question = await response.json();
      
      // Try to broadcast, but don't fail if it doesn't work (single player mode)
      sendGameMessage(GameMessageType.NEW_QUESTION, { question });
      
      // Update local state regardless of broadcast success
      setGameState(prev => ({
        ...prev,
        stage: GameStage.QUESTION_DISPLAY,
        currentQuestion: question,
        currentAnswerer: null,
        buzzAttempts: [],
        answer: null,
        followUpQuestions: [],
        followUpAnswers: [],
        finalScore: null,
        countdown: 10,
      }));

      // Countdown from 10 to 0
      const countdownInterval = setInterval(() => {
        setGameState(prev => {
          const newCountdown = prev.countdown - 1;
          if (newCountdown <= 0) {
            clearInterval(countdownInterval);
            return { ...prev, stage: GameStage.BUZZING, countdown: 0 };
          }
          return { ...prev, countdown: newCountdown };
        });
      }, 1000);

    } catch (error) {
      console.error('Failed to generate question:', error);
      alert(`Failed to generate question: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n1. OPENAI_API_KEY is set in .env.local\n2. Your OpenAI API key is valid and has credits\n3. Check browser console for details`);
    }
  }, [sendGameMessage, gameState.currentContentId]);

  // Player buzzes in
  const buzzIn = useCallback(() => {
    if (gameState.stage !== GameStage.BUZZING) return;

    sendGameMessage(GameMessageType.BUZZ_IN, { timestamp: Date.now() });
    
    setGameState(prev => ({
      ...prev,
      buzzAttempts: [...prev.buzzAttempts, { identity, timestamp: Date.now() }],
    }));

    // Start collection window if not already started
    if (!buzzCollectionTimerRef.current) {
      buzzCollectionTimerRef.current = setTimeout(() => {
        // Determine winner
        setGameState(prev => {
          if (prev.buzzAttempts.length === 0) return prev;

          const winner = prev.buzzAttempts.reduce((min, attempt) => 
            attempt.timestamp < min.timestamp ? attempt : min
          );

          sendGameMessage(GameMessageType.BUZZ_WINNER, { winner: winner.identity });

          // If I'm the winner, I need to enable camera
          // This will be handled in GameUI component to avoid timing issues
          if (winner.identity === identity) {
            console.log('I won the buzz-in, will enable camera in GameUI');
          }

          return {
            ...prev,
            stage: GameStage.ANSWERING,
            currentAnswerer: winner.identity,
            countdown: 90,
          };
        });

        buzzCollectionTimerRef.current = null;
      }, BUZZ_COLLECTION_WINDOW);
    }
  }, [gameState.stage, identity, room, sendGameMessage]);

  // Submit answer
  const submitAnswer = useCallback(async (audioBlob: Blob, transcript: string) => {
    const answer: Answer = { transcript, audioBlob };
    
    sendGameMessage(GameMessageType.ANSWER_SUBMITTED, { 
      transcript,
      answerer: identity 
    });

    setGameState(prev => ({
      ...prev,
      answer,
      stage: GameStage.SCORING,
    }));

    // Calculate final score immediately without follow-up questions
    try {
      if (!gameState.currentQuestion) return;

      const response = await fetch('/api/game/final-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: gameState.currentQuestion.content,
          answer: transcript,
          topicName: gameState.currentQuestion.topicName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to calculate score');
      }

      const finalScore = await response.json();
      
      sendGameMessage(GameMessageType.SCORE_READY, { 
        finalScore,
        answerer: identity 
      });

      setGameState(prev => ({
        ...prev,
        stage: GameStage.SCORING,
        finalScore,
      }));

      // Update player score
      setGameState(prev => {
        const newPlayers = new Map(prev.players);
        const player = newPlayers.get(prev.currentAnswerer || '');
        if (player) {
          player.score += finalScore.totalScore;
          player.hasAnswered = true;
          player.isAnswering = false;
        }
        return { ...prev, players: newPlayers };
      });

    } catch (error) {
      console.error('Failed to calculate final score:', error);
      alert(`Failed to calculate score: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check your OpenAI API configuration.`);
    }
  }, [identity, sendGameMessage, gameState.currentQuestion]);

  // Next round
  const nextRound = useCallback(() => {
    setGameState(prev => {
      const nextRoundNumber = prev.currentRound + 1;
      
      if (nextRoundNumber > prev.totalRounds) {
        // Game is over
        sendGameMessage(GameMessageType.END_GAME);
        return {
          ...prev,
          stage: GameStage.GAME_OVER,
        };
      } else {
        // Continue to next round
        sendGameMessage(GameMessageType.NEXT_ROUND);
        generateQuestion();
        return {
          ...prev,
          currentRound: nextRoundNumber,
        };
      }
    });
  }, [sendGameMessage, generateQuestion]);

  // Reset game
  const resetGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      stage: GameStage.WAITING,
      isGameActive: false,
      currentRound: 0,
      totalRounds: 5,
      currentQuestion: null,
      currentAnswerer: null,
      buzzAttempts: [],
      answer: null,
      followUpQuestions: [],
      followUpAnswers: [],
      finalScore: null,
      countdown: 0,
      players: new Map(Array.from(prev.players.entries()).map(([id, player]) => [
        id,
        { ...player, score: 0, isAnswering: false, hasAnswered: false }
      ])),
    }));
  }, []);

  // Handle incoming game messages
  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const message: GameMessage = JSON.parse(decoder.decode(payload));

        console.log('Received game message:', {
          type: message.type,
          sender: message.sender,
          isFromSelf: message.sender === identity,
          myIdentity: identity
        });

        // Skip messages from self (already handled locally)
        if (message.sender === identity) {
          console.log('Skipping message from self');
          return;
        }

        console.log('Processing message from other player:', message.type);

        // Auto-register any player who sends a message
        addPlayer(message.sender);

        switch (message.type) {
          case GameMessageType.START_GAME:
            console.log('Starting game (from remote)');
            setGameState(prev => ({ ...prev, isGameActive: true, currentRound: 1 }));
            break;

          case GameMessageType.CONFIGURE_ROUNDS:
            console.log('Received round configuration from host:', message.payload.totalRounds);
            setGameState(prev => ({ 
              ...prev, 
              totalRounds: message.payload.totalRounds 
            }));
            break;

          case GameMessageType.END_GAME:
            console.log('Game over received from host');
            setGameState(prev => ({ 
              ...prev, 
              stage: GameStage.GAME_OVER 
            }));
            break;

          case GameMessageType.SET_CONTENT:
            console.log('Received content ID from host:', message.payload.contentId);
            setGameState(prev => ({ 
              ...prev, 
              currentContentId: message.payload.contentId 
            }));
            break;

          case GameMessageType.NEW_QUESTION:
            console.log('Received new question from remote:', message.payload.question);
            setGameState(prev => ({
              ...prev,
              stage: GameStage.QUESTION_DISPLAY,
              currentQuestion: message.payload.question,
              currentAnswerer: null,
              buzzAttempts: [],
              countdown: 10,
            }));
            
            // Countdown from 10 to 0
            const remoteCountdownInterval = setInterval(() => {
              setGameState(prev => {
                const newCountdown = prev.countdown - 1;
                if (newCountdown <= 0) {
                  clearInterval(remoteCountdownInterval);
                  return { ...prev, stage: GameStage.BUZZING, countdown: 0 };
                }
                return { ...prev, countdown: newCountdown };
              });
            }, 1000);
            break;

          case GameMessageType.BUZZ_IN:
            setGameState(prev => ({
              ...prev,
              buzzAttempts: [...prev.buzzAttempts, {
                identity: message.sender,
                timestamp: message.payload.timestamp,
              }],
            }));
            break;

          case GameMessageType.BUZZ_WINNER:
            console.log('Received BUZZ_WINNER:', message.payload.winner);
            
            setGameState(prev => ({
              ...prev,
              stage: GameStage.ANSWERING,
              currentAnswerer: message.payload.winner,
              countdown: 90,
            }));
            break;

          case GameMessageType.ANSWER_SUBMITTED:
            setGameState(prev => ({
              ...prev,
              stage: GameStage.SCORING,
              answer: { transcript: message.payload.transcript },
            }));
            break;

          case GameMessageType.SCORE_READY:
            setGameState(prev => ({
              ...prev,
              stage: GameStage.SCORING,
              finalScore: message.payload.finalScore,
            }));
            break;
        }
      } catch (error) {
        console.error('Failed to parse game message:', error);
      }
    };

    room.on('dataReceived', handleData);

    return () => {
      room.off('dataReceived', handleData);
    };
  }, [room, identity]);

  return {
    gameState,
    startGame,
    setContent,
    generateQuestion,
    buzzIn,
    submitAnswer,
    nextRound,
    resetGame,
    addPlayer,
  };
}

