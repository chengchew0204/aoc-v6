export enum GameStage {
  WAITING = 'WAITING',
  QUESTION_DISPLAY = 'QUESTION_DISPLAY',
  BUZZING = 'BUZZING',
  ANSWERING = 'ANSWERING',
  AI_FOLLOWUP = 'AI_FOLLOWUP',
  SCORING = 'SCORING',
}

export interface Player {
  identity: string;
  score: number;
  isAnswering: boolean;
  hasAnswered: boolean;
}

export interface Question {
  id: string;
  topic: string;
  topicName: string;
  content: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface BuzzAttempt {
  identity: string;
  timestamp: number;
}

export interface Answer {
  transcript: string;
  audioBlob?: Blob;
}

export interface FollowUpQuestion {
  question: string;
  context: string;
}

export interface ScoreDimension {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface FinalScore {
  dimensions: ScoreDimension[];
  totalScore: number;
  totalMaxScore: number;
  overallFeedback: string;
}

export interface GameState {
  stage: GameStage;
  currentQuestion: Question | null;
  currentAnswerer: string | null;
  buzzAttempts: BuzzAttempt[];
  players: Map<string, Player>;
  answer: Answer | null;
  followUpQuestions: FollowUpQuestion[];
  followUpAnswers: Answer[];
  finalScore: FinalScore | null;
  countdown: number;
  isGameActive: boolean;
}

export enum GameMessageType {
  START_GAME = 'START_GAME',
  NEW_QUESTION = 'NEW_QUESTION',
  BUZZ_IN = 'BUZZ_IN',
  BUZZ_WINNER = 'BUZZ_WINNER',
  START_ANSWERING = 'START_ANSWERING',
  ANSWER_SUBMITTED = 'ANSWER_SUBMITTED',
  FOLLOWUP_READY = 'FOLLOWUP_READY',
  FOLLOWUP_ANSWER_SUBMITTED = 'FOLLOWUP_ANSWER_SUBMITTED',
  SCORE_READY = 'SCORE_READY',
  NEXT_ROUND = 'NEXT_ROUND',
  END_GAME = 'END_GAME',
  PLAYER_JOINED = 'PLAYER_JOINED',
  SYNC_STATE = 'SYNC_STATE',
}

export interface GameMessage {
  type: GameMessageType;
  timestamp: number;
  sender: string;
  payload?: any;
}

