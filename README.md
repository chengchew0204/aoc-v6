# Arena of Consciousness  

A real-time streaming platform with an AI-powered quiz game, built to demonstrate full-stack development capabilities with WebRTC, real-time communication, and AI integration.

## Overview

Arena of Consciousness is a web-based platform that combines real-time video/audio streaming with an interactive AI quiz game. The platform features a unique "takeover" mechanism where any participant can become the broadcaster, creating a dynamic, competitive streaming environment. The quiz game mode leverages OpenAI's GPT-4 and Whisper APIs to generate questions, evaluate spoken answers, and provide intelligent feedback.

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - UI component library
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **LiveKit Components** - Pre-built WebRTC UI components

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **LiveKit Server SDK** - WebRTC signaling and room management
- **OpenAI API** - GPT-4 for question generation and evaluation, Whisper for speech-to-text

### Real-time Communication
- **LiveKit Cloud** - WebRTC infrastructure
- **WebRTC** - Peer-to-peer media streaming
- **LiveKit Data Channels** - Real-time signaling and game state synchronization

### Deployment
- **Netlify** - Serverless hosting and continuous deployment

## Key Features

### Real-time Streaming
- Sub-second latency video/audio streaming using WebRTC SFU architecture
- Dynamic broadcaster takeover system with automatic track management
- Unlimited concurrent viewers with efficient bandwidth usage
- Automatic reconnection handling

### AI-Powered Quiz Game
- GPT-4 generated open-ended questions across multiple knowledge domains
- Voice-based answer submission with Whisper speech-to-text transcription
- Real-time AI evaluation with follow-up questions to test deeper understanding
- Multi-dimensional scoring: concept accuracy, structural coherence, practical examples, and response quality
- Buzzer system with race condition handling (200ms collection window)

### Content Upload & Analysis
- Support for URL-based content ingestion (articles, documentation)
- Automated question generation from uploaded content
- Content analysis and processing pipeline

## System Architecture

### WebRTC Infrastructure
The platform uses LiveKit's SFU (Selective Forwarding Unit) architecture for efficient real-time streaming:
- Participants connect to a central SFU server
- Video/audio tracks are selectively forwarded to subscribers
- Data channels handle game state synchronization
- JWT-based authentication for secure room access

### API Design

#### Authentication & Access
- `POST /api/token` - Generate LiveKit JWT tokens with configurable permissions

#### Streaming Control
- `POST /api/takeover` - Manage broadcaster transitions by muting previous tracks

#### Game Logic
- `POST /api/game/generate-question` - Generate questions from database or custom content
- `POST /api/game/transcribe` - Convert audio to text using Whisper API
- `POST /api/game/evaluate-answer` - AI evaluation with GPT-4
- `POST /api/game/final-score` - Calculate and return comprehensive scores
- `GET /api/game/check-config` - Verify API configuration

#### Content Processing
- `POST /api/content/process` - Fetch and parse web content
- `POST /api/content/analyze` - Generate questions from content using GPT-4

## Technical Highlights

### Real-time State Management
- Client-side game state synchronized via LiveKit Data Channels
- Custom React hooks for managing complex game flow
- Optimistic UI updates with server reconciliation

### Audio Pipeline
- Browser MediaRecorder API for audio capture
- Binary blob transmission to backend
- OpenAI Whisper API for high-accuracy transcription
- Average transcription time: 2-3 seconds

### Race Condition Handling
- 200ms buzzer collection window to handle network latency
- Timestamp-based priority for simultaneous buzz-ins
- Server-authoritative game state to prevent cheating

### Video Track Management
- Dynamic camera enable/disable based on game state
- Automatic video element attachment and cleanup
- WebRTC track lifecycle management

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- LiveKit Cloud account (or self-hosted LiveKit server)
- OpenAI API key with GPT-4 and Whisper access

### Environment Variables
Create a `.env.local` file in the root directory:

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
OPENAI_API_KEY=sk-your_openai_key
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The application will be available at `http://localhost:3000`

### Testing Media Devices
Visit `/test-media` to verify camera and microphone access before joining the main arena.

## Game Concept

### The Arena
The "Arena" represents a shared consciousness space where only one broadcaster can exist at any moment. Participants can "takeover" the broadcast at any time, creating a competitive dynamic for visibility and dominance. This mechanic explores themes of attention, persistence, and collective awareness in digital spaces.

### Quiz Game Mode
The quiz game transforms the arena into a knowledge competition:
1. AI generates open-ended questions from pre-defined topics or custom content
2. Players buzz in to answer (first to buzz gets to respond)
3. Winner records a 90-second voice answer
4. AI transcribes and evaluates the response
5. AI may ask follow-up questions to probe deeper understanding
6. Comprehensive scoring across multiple dimensions

The game demonstrates advanced full-stack integration: real-time communication, AI processing, audio handling, and complex state management all working in harmony.

## Project Structure

```
src/
├── app/
│   ├── api/              # Next.js API routes
│   │   ├── token/        # LiveKit JWT generation
│   │   ├── takeover/     # Broadcaster management
│   │   ├── game/         # Quiz game endpoints
│   │   └── content/      # Content processing
│   ├── page.tsx          # Main landing page
│   └── test-media/       # Device testing page
├── components/           # React components
│   ├── LiveKitRoom.tsx   # Main room component
│   ├── GameUI.tsx        # Quiz game interface
│   ├── AudioRecorder.tsx # Voice recording
│   └── ContentUpload.tsx # Content ingestion
├── hooks/                # Custom React hooks
│   └── useGameState.ts   # Game state management
├── types/                # TypeScript definitions
└── utils/                # Helper functions
```

## Documentation

Additional documentation is available in the `/docs` directory:
- Game introduction and rules
- Deployment guide
- Testing procedures
- Implementation details

## License

This project is a portfolio demonstration of full-stack development capabilities.
