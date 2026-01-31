# CAGEBAIT: Honeypot API Endpoint to trap Scammers

An AI-powered scam detection and engagement API that detects scam messages, chats with scammers using AI personas, extracts intelligence (bank accounts, UPI IDs, phone numbers, links), and reports back to GUVI.

## Tech Stack

- **Express.js** - REST API framework
- **React.js** - Frontend (demo purposes only)
- **Google Gemini** - Gemini 3 Flash for scam detection & agent responses

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Edit `.env` file with your keys:

```env
API_KEY=your-secret-api-key-here
GOOGLE_API_KEY=your-gemini-api-key-here
PORT=8000
```

### 3. Run the API

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

## API Usage

### Endpoint

```
POST /api/honeypot
Header: x-api-key: YOUR_SECRET_KEY
```

### Request Body

```json
{
  "sessionId": "abc123",
  "message": {
    "sender": "scammer",
    "text": "Your bank account will be blocked. Verify now."
  },
  "conversationHistory": []
}
```

### Response

```json
{
  "status": "success",
  "response": "Oh no! What do I need to do?",
  "scamDetected": true
}
```

### Test with cURL

```bash
curl -X POST http://localhost:8000/api/honeypot \
  -H "x-api-key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test123",
    "message": {
      "sender": "scammer",
      "text": "Your account is blocked. Verify now."
    },
    "conversationHistory": []
  }'
```

### Health Check

```bash
curl http://localhost:8000/health
```

## Features

- **Multi-layer scam detection**: Keyword matching + Gemini AI analysis
- **AI personas**: Elderly, Professional, Newbie characters
- **Phased engagement**: Initial → Gathering → Trust → Extraction → Exit
- **Intelligence extraction**: Bank accounts, UPI IDs, phone numbers, URLs
- **Auto-reporting**: Sends collected data to GUVI callback

## Project Structure

```
honeypot-api/
├── src/
│   ├── index.js             # Express app entry
│   ├── config.js            # Configuration
│   ├── routes/
│   │   └── honeypot.js      # API endpoint
│   └── services/
│       ├── scamDetector.js  # Scam detection
│       ├── agent.js         # AI chatbot
│       ├── intelligence.js  # Data extraction
│       └── session.js       # Redis sessions
├── .env                     # Environment variables
├── package.json
└── README.md
```

## Deployment

About to deploy to Railway, Render, or Vercel to get a public URL for testing.
