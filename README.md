# CAGEBAIT

```
  /$$$$$$   /$$$$$$   /$$$$$$  /$$$$$$$$ /$$$$$$$   /$$$$$$  /$$$$$$ /$$$$$$$$
 /$$__  $$ /$$__  $$ /$$__  $$| $$_____/| $$__  $$ /$$__  $$|_  $$_/|__  $$__/
| $$  \__/| $$  \ $$| $$  \__/| $$      | $$  \ $$| $$  \ $$  | $$     | $$   
| $$      | $$$$$$$$| $$ /$$$$| $$$$$   | $$$$$$$ | $$$$$$$$  | $$     | $$   
| $$      | $$__  $$| $$|_  $$| $$__/   | $$__  $$| $$__  $$  | $$     | $$   
| $$    $$| $$  | $$| $$  \ $$| $$      | $$  \ $$| $$  | $$  | $$     | $$   
|  $$$$$$/| $$  | $$|  $$$$$$/| $$$$$$$$| $$$$$$$/| $$  | $$ /$$$$$$   | $$   
 \______/ |__/  |__/ \______/ |________/|_______/ |__/  |__/|______/   |__/   
                                                                              
```

**An autonomous, voice-interactive AI honeypot designed to waste scammers' time and extract actionable threat intelligence in real time.**

CAGEBAIT traps phone/call scammers by deploying a convincing AI persona that talks back using synthesized voice, keeps the scammer engaged across multiple conversational phases, and silently scrapes every piece of identifying information they reveal — bank accounts, UPI IDs, phone numbers, names, and phishing links — all displayed live on a brutalist command-center dashboard.

---

## Key Features

| Feature | Description |
|---|---|
| **Voice-Interactive Agent** | Real-time speech-to-text (browser STT) + text-to-speech (Murf Falcon API) creates a fully hands-free voice conversation loop. |
| **Multi-Persona System** | Three distinct personas — `elderly`, `professional`, `newbie` — each with unique vocal characteristics, personality traits, and pitch-shifted voices. |
| **Phased Manipulation** | The AI progresses through 5 psychological engagement phases: Paranoia → Information Gathering → Trust Building → Intelligence Extraction → Graceful Exit. |
| **Concurrent Intelligence Extraction** | A secondary Gemini LLM instance runs in parallel (`Promise.all`) to parse the full conversation context for structured PII — adding **zero latency** to the response cycle. |
| **Live Dashboard** | A brutalist, CRT-inspired React frontend with real-time mic waveform visualization, scrollable conversation stream, and a live DATA_EXTRACTION intel feed. |
| **Session Persistence** | Completed sessions are automatically dumped to `backend/sessions/*.json` for offline forensic analysis. |
| **Pause/Resume** | Hidden session pause control freezes the mic, timer, and STT pipeline without terminating the session. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite + Tailwind CSS v4 |
| **Backend** | Node.js + Express.js |
| **LLM (Agent)** | Google Gemini 2.5 Flash via `@google/generative-ai` SDK |
| **LLM (Intel)** | Google Gemini 3.1 Flash Lite Preview (concurrent extraction) |
| **Voice Synthesis** | Murf AI Falcon Streaming API |
| **Speech-to-Text** | Browser-native Web Speech Recognition API |
| **Audio Visualization** | Web Audio API (`AudioContext` + `AnalyserNode`) |

---

## Project Structure

```
CAGEBAIT/
├── src/                          # Frontend (Vite + React)
│   ├── App.jsx                   # Main dashboard component
│   ├── main.jsx                  # React entry point
│   └── index.css                 # Global styles
├── backend/                      # Backend (Express API)
│   ├── src/
│   │   ├── index.js              # Express server entry
│   │   ├── config.js             # Environment configuration
│   │   ├── routes/
│   │   │   ├── honeypot.js       # Text-based honeypot endpoint
│   │   │   └── voice.js          # Voice honeypot endpoint (primary)
│   │   └── services/
│   │       ├── agent.js          # Gemini-powered conversational AI
│   │       ├── intelligence.js   # Gemini-powered PII extraction
│   │       ├── murfTTS.js        # Murf Falcon TTS integration
│   │       ├── scamDetector.js   # Multi-layer scam classifier
│   │       └── session.js        # In-memory session manager
│   ├── sessions/                 # Auto-generated session logs (JSON)
│   ├── .env                      # API keys (not committed)
│   └── package.json
├── public/
│   └── imagebait.png             # Logo asset
├── index.html                    # Vite HTML entry
├── vite.config.js
├── package.json
└── README.md
```

---

## Setup Guide

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- A **Google AI Studio** API key ([Get one here](https://aistudio.google.com/apikey))
- A **Murf AI** API key ([Sign up here](https://murf.ai))
- A Chromium-based browser (Chrome, Safari or Edge) for Web Speech API support

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/CAGEBAIT.git
cd CAGEBAIT
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

### 4. Configure Environment Variables

Create (or edit) the file `backend/.env`:

```env
GOOGLE_API_KEY=your-google-gemini-api-key
MURF_API_KEY=your-murf-ai-api-key
MURF_REGION=in
PORT=8000
```

| Variable | Description |
|---|---|
| `GOOGLE_API_KEY` | Your Google Generative AI API key. Used for both the Agent LLM and the Intelligence Extractor. |
| `MURF_API_KEY` | Your Murf AI API key for the Falcon streaming TTS engine. |
| `MURF_REGION` | Murf API region prefix. Use `in` for India, `us` for United States. |
| `PORT` | Backend server port. Defaults to `8000`. |

### 5. Start the Backend

```bash
cd backend
npm run dev
```

You should see:

```
Session Manager initialized (In-Memory Only)
🚀 CAGEBAIT API running on port 8000
```

### 6. Start the Frontend (in a separate terminal)

```bash
# From the project root
npm run dev
```

Vite will start at `http://localhost:5173`.

### 7. Open in Browser

Navigate to `http://localhost:5173` in **Chrome** or **Edge**. Click **"🎤 ALLOW MIC & INITIATE"** to grant microphone permissions and begin the session.

---

## Usage

### Voice Mode (Primary)

1. Click **ALLOW MIC & INITIATE** on the briefing screen.
2. Speak as if you are a scammer — the AI agent will respond with a synthesized voice.
3. Watch the **CONVERSATION STREAM** panel for the live transcript.
4. Watch the **DATA_EXTRACTION** panel on the right for scraped intelligence.
5. Use the **PAUSE SESSION** button (top-left) to freeze the conversation without ending it.

### Text Fallback

Use the text input at the bottom of the left panel to type messages directly instead of speaking.

### Session Logs

When a session concludes (after 15 messages or 10 minutes), the full session data is automatically saved to:

```
backend/sessions/SESSION_<timestamp>.json
```

Each log contains the complete conversation history, extracted intelligence, persona used, and engagement metrics.

---

## API Reference

### `POST /api/voice-honeypot`

The primary endpoint used by the frontend dashboard.

**Request:**
```json
{
  "sessionId": "SESSION_1774710885325",
  "text": "Your bank account has been compromised."
}
```

**Response:**
```json
{
  "status": "success",
  "response": "Oh my God, what happened? Which department are you calling from?",
  "audioUrl": "data:audio/mpeg;base64,...",
  "scamDetected": true,
  "persona": "elderly",
  "voiceUsed": { "voiceId": "Samar", "style": "Conversational", "pitch": -15 },
  "messageCount": 3,
  "extractedIntelligence": {
    "bankAccounts": [],
    "upiIds": [],
    "phoneNumbers": ["+919876543210"],
    "phishingLinks": [],
    "suspiciousKeywords": ["blocked", "verify"],
    "scammerInfo": ["Officer Sharma", "RBI Cyber Cell"]
  },
  "conversationHistory": [...]
}
```


### `GET /health`

Health check endpoint. Returns `{ status: "ok" }`.

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (Frontend)                    │
│  ┌──────────┐    ┌──────────┐    ┌───────────────────┐  │
│  │ Web STT  │───▶│ App.jsx  │───▶│  fetch() → API    │  │
│  │ (Mic In) │    │ (React)  │◀───│  ◀── JSON + Audio │  │
│  └──────────┘    └──────────┘    └───────────────────┘  │
│       ▲               │                                  │
│       │          ┌─────▼─────┐                           │
│       └──────────│ Audio API │ (Plays Murf MP3)          │
│                  └───────────┘                           │
└─────────────────────────────────────────────────────────┘
                         │
                    HTTP POST
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   SERVER (Backend)                        │
│                                                          │
│  1. SessionManager  →  Create or retrieve session        │
│  2. ScamDetector    →  Gemini classifies scam intent     │
│  3. Promise.all([                                        │
│       Agent.generateResponse()   ← Gemini 2.5 Flash     │
│       IntelExtractor.extract()   ← Gemini 3.1 Flash-Lite│
│     ])                                                   │
│  4. MurfTTS         →  Falcon streaming TTS → MP3        │
│  5. Return JSON + base64 Audio Data URI                  │
│                                                          │
│  On session end → fs.writeFile → sessions/*.json         │
└─────────────────────────────────────────────────────────┘
```

---

## Configuration Notes

### Persona Voice Mapping

| Persona | Voice ID | Style | Pitch |
|---|---|---|---|
| `elderly` | Samar / Anisha | Conversational | -15 (lower) |
| `professional` | Samar / Anisha | Conversational | 0 (neutral) |
| `newbie` | Samar / Anisha | Conversational | +20 (higher) |

### Session Auto-Termination

Sessions end automatically when any of these conditions are met:

- Message count reaches **15**
- Duration exceeds **10 minutes**
- **5+ intelligence items** collected after 8 messages
- **3 consecutive messages** with no new intelligence after 8 messages


