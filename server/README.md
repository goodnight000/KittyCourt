# Judge Engine - Cat Judge Backend

The **Judge Engine** is the core AI-powered backend service for Cat Judge. It processes couple disputes through a rigorous psychological protocol based on the **Gottman Method** and **Nonviolent Communication (NVC)** principles, delivering verdicts in the persona of **Judge Mittens**.

## Architecture

```
server/
├── src/
│   ├── app.js                 # Express server entry point
│   ├── routes/
│   │   └── judge.js           # Judge API endpoints
│   └── lib/
│       ├── openai.js          # OpenAI client configuration
│       ├── schemas.js         # Zod validation schemas
│       ├── prompts.js         # System prompts for LLM pipeline
│       ├── judgeEngine.js     # Core deliberation pipeline
│       ├── repairAttempts.js  # Research-backed repair exercises
│       └── judgeEngine.test.js # Unit tests
```

## The Deliberation Pipeline

The Judge Engine uses a **3-step sequential chain** to process disputes:

### Step 1: Safety Guardrail (Moderation API)
- Runs all user-submitted text through OpenAI's Moderation API
- Detects self-harm, severe violence, or abuse
- Returns `unsafe_counseling_recommended` status if severe flags are triggered
- Protects users and provides appropriate resources

### Step 2: Analytical Phase (JSON Mode)
- Sends structured inputs to GPT-4o with psychological analysis instructions
- **No persona** - pure clinical analysis
- Detects Gottman's "Four Horsemen":
  - Criticism
  - Contempt  
  - Defensiveness
  - Stonewalling
- Translates surface complaints into vulnerable needs
- Output: Structured JSON analysis

### Step 3: Verdict Generation (Persona Injection)
- Takes original input + Step 2 analysis
- Injects **Judge Mittens** persona
- Generates the four-part verdict structure:
  - **The Purr** (Validation)
  - **The Hiss** (Call-outs)
  - **The Translation** (Root conflict)
  - **The Sentence** (Repair attempt)

## API Endpoints

### POST `/api/judge/deliberate`
Main endpoint for submitting a dispute.

**Request Body:**
```json
{
  "participants": {
    "userA": { "name": "Alex", "id": "u123" },
    "userB": { "name": "Sam", "id": "u456" }
  },
  "submissions": {
    "userA": {
      "cameraFacts": "I came home and the dishes were in the sink.",
      "selectedPrimaryEmotion": "Overwhelmed",
      "theStoryIamTellingMyself": "That I am not a priority.",
      "coreNeed": "Support & Partnership"
    },
    "userB": {
      "cameraFacts": "Alex commented on the dishes immediately.",
      "selectedPrimaryEmotion": "Defensive",
      "theStoryIamTellingMyself": "That I am being attacked.",
      "coreNeed": "Appreciation & Peace"
    }
  }
}
```

**Success Response:**
```json
{
  "verdictId": "v_abc123",
  "timestamp": "2023-10-27T10:00:00Z",
  "status": "success",
  "judgeContent": {
    "openingStatement": "Court is in session...",
    "validation_ThePurr": {
      "userA": "Alex, your feeling of being overwhelmed is valid...",
      "userB": "Sam, your need for peace is understandable..."
    },
    "callouts_TheHiss": [
      "However, Alex, the court detects 'Criticism'. Hiss.",
      "Sam, you engaged in 'Stonewalling'. Bad human."
    ],
    "translationSummary": "You are fighting about energy level mismatches...",
    "theSentence_RepairAttempt": {
      "title": "The Six-Second Reset",
      "description": "Engage in a hug lasting six full seconds..."
    },
    "closingStatement": "Case closed. Now feed me."
  },
  "_meta": {
    "analysis": { ... },
    "processingTimeMs": 3500
  }
}
```

**Error Responses:**
- `400` - Invalid input (validation failed)
- `200` with `status: "unsafe_counseling_recommended"` - Content flagged
- `503` - OpenAI API key not configured

### GET `/api/judge/health`
Health check endpoint.

### POST `/api/judge/test` (Development only)
Runs a sample dispute through the pipeline.

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional
PORT=3000
NODE_ENV=development  # Set to 'production' to disable test endpoints
DATABASE_URL="file:./dev.db"
```

### Model Configuration

In `lib/judgeEngine.js`:
```javascript
const CONFIG = {
    analysisModel: 'gpt-4o',      // Model for Step 2
    verdictModel: 'gpt-4o',        // Model for Step 3
    temperature: 0.7,               // Creativity level
    maxTokens: 2000,               // Max output tokens
};
```

## Running the Server

```bash
# Install dependencies
npm install

# Set up database
npx prisma migrate dev

# Start development server
npm run dev

# Run tests
npm test
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Test the API manually
curl -X POST http://localhost:3000/api/judge/test
```

## Psychological Framework

### Gottman's Four Horsemen
The engine detects these toxic communication patterns:

1. **Criticism** - Attacking partner's character ("You always...", "You never...")
2. **Contempt** - Superiority, mockery, name-calling
3. **Defensiveness** - Making excuses, not taking responsibility
4. **Stonewalling** - Withdrawing, shutting down

### NVC Translation
Transforms complaints into vulnerable needs:
- Surface: "You never help with dishes"
- Translation: "I feel overwhelmed and need partnership in household tasks"

### Repair Attempts
Low-stakes exercises to reconnect:
- Physical: Hugs, hand-holding
- Verbal: Appreciation exchanges
- Playful: Silly faces, dance breaks
- Reflective: Deep listening exercises

## Security Considerations

- All user text is moderated before LLM processing
- Severe safety flags halt the pipeline
- No user data is logged or stored by the LLM
- API key should be kept secret and rotated regularly
