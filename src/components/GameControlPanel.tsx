'use client';

import { GameState, GameStage } from '@/types/game';

interface GameControlPanelProps {
  gameState: GameState;
  onStartGame: () => void;
  onGenerateQuestion: () => void;
  onNextRound: () => void;
}

export default function GameControlPanel({
  gameState,
  onStartGame,
  onGenerateQuestion,
  onNextRound,
}: GameControlPanelProps) {
  const handleStartGame = () => {
    onStartGame();
    // Auto-generate first question after starting
    setTimeout(() => {
      onGenerateQuestion();
    }, 500);
  };

  return (
    <div className="absolute top-20 left-4 z-20 border border-gray-700 bg-black bg-opacity-80 p-4 space-y-3 min-w-[200px]">
      <div className="text-white text-xs font-medium mb-2 border-b border-gray-700 pb-2">
        Game Controls
      </div>

      {!gameState.isGameActive ? (
        <div className="space-y-2">
          <button
            onClick={handleStartGame}
            className="w-full border border-green-500 text-green-500 hover:bg-green-500 hover:text-black transition-colors duration-200 px-4 py-2 text-xs font-medium"
          >
            Start Game & Generate Question
          </button>
          <p className="text-gray-500 text-xs text-center">
            Click to begin the game
          </p>
        </div>
      ) : (
        <>
          {gameState.stage === GameStage.WAITING && (
            <button
              onClick={onGenerateQuestion}
              className="w-full border border-white text-white hover:bg-white hover:text-black transition-colors duration-200 px-4 py-2 text-xs"
            >
              Generate New Question
            </button>
          )}

          {gameState.stage === GameStage.SCORING && (
            <button
              onClick={onNextRound}
              className="w-full border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-black transition-colors duration-200 px-4 py-2 text-xs"
            >
              Next Round
            </button>
          )}

          <div className="text-gray-400 text-xs mt-4">
            <div className="mb-1">Stage: <span className="text-white">{gameState.stage}</span></div>
            <div>Players: <span className="text-white">{gameState.players.size}</span></div>
          </div>
        </>
      )}
    </div>
  );
}

