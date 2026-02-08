# Fractal Server

Backend API for Fractal's AI question exploration, evaluation telemetry, and probe synthesis workflows.

## Overview

The server provides:

- AI question generation with multiple prompt variants
- Online LLM-judge scoring (quality, confidence, uncertainty)
- Prompt/model performance memory persisted to disk
- Session token guardrails with warning/limit behavior
- A/B generation compare endpoint
- Chat and Probe synthesis endpoints
- Probe brief export and next-experiment suggestions
- Concept extraction and concept explanation endpoints
- W&B Weave tracing for all major inference operations

## Tech Stack

- Runtime: Node.js 18+
- Framework: Express
- Language: TypeScript
- LLM provider: W&B Inference (OpenAI-compatible)
- Observability: W&B Weave

## Setup

### Prerequisites

- Node.js 18+
- W&B API key ([wandb.ai/settings](https://wandb.ai/settings))

### Installation

```bash
npm install
cp .env.example .env
# edit .env and set WANDB_API_KEY
```

### Environment Variables

| Variable | Description | Required |
|---|---|---|
| `WANDB_API_KEY` | W&B API key | Yes |
| `WANDB_PROJECT` | W&B project name (default: `fractal`) | No |
| `PORT` | Server port (default: `3001`) | No |
| `NODE_ENV` | Runtime mode (default: `development`) | No |
| `POLICY_MEMORY_PATH` | Path to persisted eval policy/model memory (default: `./data/policy-memory.json`) | No |
| `MAX_TOKENS_PER_SESSION` | Session token hard limit (default: `40000`) | No |
| `TOKEN_WARNING_THRESHOLD` | Warning ratio (0-1) for budget banner (default: `0.8`) | No |

## Run

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

### Health

`GET /health`

Returns server status and inference health.

### Generate Questions

`POST /api/generate`

Request:

```json
{
  "question": "What drives trust in AI-generated recommendations?",
  "model": "meta-llama/Llama-3.1-8B-Instruct"
}
```

Response shape highlights:

- `questions: string[]`
- `meta.promptVariant`, `meta.promptLabel`
- `meta.qualityScore`, `meta.confidence`, `meta.uncertainty`
- `meta.strengths`, `meta.weaknesses`
- `meta.seedType`
- `meta.costGuard`
- `usage` token stats

### Compare Generation Runs

`POST /api/generate/compare`

Request:

```json
{
  "question": "How can product teams reduce launch risk?",
  "leftModel": "meta-llama/Llama-3.1-8B-Instruct",
  "rightModel": "meta-llama/Llama-3.1-8B-Instruct",
  "leftPromptVariantId": "v1-balanced",
  "rightPromptVariantId": "v2-divergent"
}
```

Response includes:

- `left` and `right` full generation payloads
- `winner: "left" | "right" | "tie"`
- `reason`

### Eval Telemetry Snapshot

`GET /api/evals/stats`

Returns:

- `promptVariants[]` with avg score/confidence/uncertainty/latency
- `recentRuns[]`
- `tokenUsage` total + by operation
- `costGuard`
- `modelPerformance[]` by seed type
- `topModelBySeedType`

### Models

- `GET /api/models` returns available model IDs
- `GET /api/models/performance` returns persisted model performance memory

### Chat

`POST /api/chat`

Chat for deep-dive exploration of a locked question.

### Probe Chat

`POST /api/probe/chat`

Synthesis chat with selected stash context.

### Probe Brief Export

`POST /api/probe/brief`

Builds a structured PM brief plus markdown output from stash context + direction.

### Probe Experiment Suggestions

`POST /api/probe/experiments`

Returns 3-5 next experiment suggestions (`title`, `hypothesis`, `metric`).

### Concept Extraction

`POST /api/concepts/extract`

Returns extracted concepts with category and text span indices.

### Concept Explanation

`POST /api/concepts/explain`

Returns concept summary, contextual explanation, and related concepts.

## Golden Regression Evals

Run fixed-question prompt-variant evals and write a markdown report:

```bash
npm run evals:golden
```

Output path:

- `server/reports/golden-evals-<timestamp>.md`

## Observability

All major inference calls are wrapped with Weave ops. View traces at:

- `https://wandb.ai/<your-account>/<your-project>`

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm test` | Run server tests |
| `npm run evals:golden` | Run golden regression eval script |

## License

MIT (see root `LICENSE`).
