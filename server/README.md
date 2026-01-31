# Fractal Server

Backend API server for the Fractal application.

## Overview

The Fractal server provides:

- **AI Question Generation** via W&B Inference
- **Intelligent Concept Extraction** via W&B Inference
- **Contextual Concept Explanations** via W&B Inference
- **Chat/Conversation API** for deep question exploration
- **Tracing & Observability** via W&B Weave
- **RESTful API** for the React frontend

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **LLM Provider**: W&B Inference (OpenAI-compatible API)
- **Observability**: W&B Weave

## Setup

### Prerequisites

- Node.js 18+
- W&B API Key (get one at https://wandb.ai/settings)

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your WANDB_API_KEY
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `WANDB_API_KEY` | Your Weights & Biases API key | Yes |
| `WANDB_PROJECT` | W&B project name (default: `fractal`) | No |
| `PORT` | Server port (default: `3001`) | No |
| `NODE_ENV` | Environment (default: `development`) | No |

## Running

### Development

```bash
npm run dev
```

Starts the server with hot-reload via `tsx watch`.

### Production

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

```
GET /health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-31T12:00:00.000Z",
  "services": {
    "inference": "up"
  }
}
```

### Generate Questions

```
POST /api/generate
```

Request:
```json
{
  "question": "What is consciousness?",
  "model": "meta-llama/Llama-3.1-8B-Instruct"  // optional
}
```

Response:
```json
{
  "success": true,
  "data": {
    "questions": [
      "Is consciousness emergent from neural complexity?",
      "Can artificial systems achieve consciousness?",
      "How does subjective experience relate to physical reality?"
    ],
    "model": "meta-llama/Llama-3.1-8B-Instruct",
    "usage": {
      "promptTokens": 152,
      "completionTokens": 86,
      "totalTokens": 238
    }
  }
}
```

### List Models

```
GET /api/models
```

Response:
```json
{
  "success": true,
  "data": {
    "models": [
      "meta-llama/Llama-3.1-8B-Instruct",
      "deepseek-ai/DeepSeek-V3-0324",
      ...
    ]
  }
}
```

### Chat

```
POST /api/chat
```

Request:
```json
{
  "rootQuestion": "What is consciousness?",
  "messages": [
    { "role": "user", "content": "Help me explore this." }
  ],
  "model": "meta-llama/Llama-3.1-8B-Instruct"  // optional
}
```

Response:
```json
{
  "success": true,
  "data": {
    "message": "Consciousness is a fascinating topic...",
    "model": "meta-llama/Llama-3.1-8B-Instruct",
    "usage": {
      "promptTokens": 200,
      "completionTokens": 150,
      "totalTokens": 350
    }
  }
}
```

### Extract Concepts

```
POST /api/concepts/extract
```

Request:
```json
{
  "text": "Why do dreams serve an evolutionary function?",
  "model": "meta-llama/Llama-3.1-8B-Instruct"  // optional
}
```

Response:
```json
{
  "success": true,
  "data": {
    "concepts": [
      {
        "id": "c_1706745600000_abc123",
        "text": "dreams",
        "normalizedName": "dreams",
        "category": "psychology",
        "startIndex": 7,
        "endIndex": 13
      },
      {
        "id": "c_1706745600001_def456",
        "text": "evolutionary",
        "normalizedName": "evolution",
        "category": "science",
        "startIndex": 23,
        "endIndex": 35
      }
    ],
    "sourceText": "Why do dreams serve an evolutionary function?"
  }
}
```

### Explain Concept

```
POST /api/concepts/explain
```

Request:
```json
{
  "conceptId": "c_1706745600000_abc123",
  "conceptName": "dreams",
  "questionContext": "Why do dreams serve an evolutionary function?",
  "model": "meta-llama/Llama-3.1-8B-Instruct"  // optional
}
```

Response:
```json
{
  "success": true,
  "data": {
    "conceptId": "c_1706745600000_abc123",
    "normalizedName": "dreams",
    "summary": "Dreams are a series of images, ideas, and sensations occurring during sleep.",
    "context": "In the context of evolutionary biology, dreams may have developed as...",
    "relatedConcepts": ["REM sleep", "consciousness", "memory consolidation"]
  }
}
```

## Observability

All LLM calls are automatically traced via W&B Weave. View your traces at:

```
https://wandb.ai/your-username/fractal
```

### What's Traced

- Input questions
- Generated outputs
- Token usage
- Latency
- Model used
- Any errors

## Architecture

```
server/
├── src/
│   ├── index.ts          # Server entry point
│   ├── config.ts         # Environment configuration
│   ├── routes.ts         # Express routes
│   ├── inference.ts      # W&B Inference integration
│   └── weave-client.ts   # W&B Weave initialization
├── .env.example          # Environment template
├── package.json
└── tsconfig.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run production build |
| `npm test` | Run tests |

## License

MIT - See root [LICENSE](../LICENSE)
