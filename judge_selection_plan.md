# Judge Selection Feature Implementation Plan

## Overview
This plan outlines the implementation of a judge selection feature that allows users to choose between different judges (LLMs) before starting a court case. Each judge has different characteristics and uses a different LLM model through OpenRouter.

## Judge Types

1. **The Best Judge** (empathic, logical, experienced)
   - Model: `opus 4.5`
   - Best for: Heated cases
   - Characteristics: High empathy, strong logic, years of experience

2. **The Fast Judge** (quick verdicts)
   - Model: `deepseek v3.2`
   - Best for: Timely resolutions
   - Characteristics: Speed-focused, efficient

3. **The Logical Judge** (balanced approach)
   - Model: `kimi k2 thinking`
   - Best for: Any case size
   - Characteristics: Logical, methodical

## Implementation Strategy

### 1. Judge Selection UI Component

**Location**: `client/src/components/court/JudgeSelection.jsx`

**Design**:
- Modal dialog that appears when user clicks "File a New Case"
- Three judge options with visual representations
- Each judge has:
  - Name and title
  - Description of characteristics
  - Model information
  - Visual avatar/icon
- "Confirm Selection" button

### 2. Court Store Modifications

**File**: `client/src/store/courtStore.js`

**Changes**:
- Add `selectedJudge` state variable
- Add `setSelectedJudge` action
- Modify `serve` action to include selected judge in API call
- Default judge: "The Logical Judge" (kimi k2 thinking)

### 3. CourtAtRest Component Updates

**File**: `client/src/components/court/CourtAtRest.jsx`

**Changes**:
- Add judge selection state
- Modify "File a New Case" button to open judge selection modal
- Integrate JudgeSelection component
- Pass selected judge to serve action

### 4. Server-Side Changes

#### Court Session Manager
**File**: `server/src/lib/courtSessionManager.js`

**Changes**:
- Add `judgeType` to session object
- Modify `serve` method to accept and store judge type
- Pass judge type to verdict generation

#### Judge Engine
**File**: `server/src/lib/judgeEngine.js`

**Changes**:
- Modify `deliberate` function to accept judge type parameter
- Update model selection based on judge type:
  - "best": `opus 4.5`
  - "fast": `deepseek v3.2`
  - "logical": `kimi k2 thinking`
- Maintain all existing functionality with new model selection

#### API Routes
**File**: `server/src/routes/court.js`

**Changes**:
- Update `/serve` endpoint to accept `judgeType` parameter
- Pass judge type to session manager

### 5. Database Considerations

- Add `judge_type` column to court sessions table
- Store selected judge with each case for historical reference
- Update session recovery to include judge type

## Technical Implementation Details

### Judge Selection Modal

```jsx
// Example structure for JudgeSelection component
const JudgeSelection = ({ onSelect, onCancel }) => {
  const judges = [
    {
      id: 'best',
      name: 'The Best Judge',
      description: 'Empathic, logical, and experienced. Best for heated cases.',
      model: 'Opus 4.5',
      icon: <Gavel className="text-gold" />
    },
    {
      id: 'fast',
      name: 'The Fast Judge',
      description: 'Quick verdicts for timely resolutions.',
      model: 'DeepSeek v3.2',
      icon: <Zap className="text-blue" />
    },
    {
      id: 'logical',
      name: 'The Logical Judge',
      description: 'Balanced approach for any case size.',
      model: 'Kimi K2 Thinking',
      icon: <Scale className="text-green" />
    }
  ];

  return (
    <Modal>
      <h2>Select Your Judge</h2>
      <div className="judge-options">
        {judges.map(judge => (
          <JudgeCard 
            key={judge.id}
            judge={judge}
            onSelect={() => onSelect(judge.id)}
          />
        ))}
      </div>
    </Modal>
  );
};
```

### Model Selection Logic

```javascript
// In judgeEngine.js
function getModelForJudgeType(judgeType) {
  const judgeModels = {
    best: 'opus 4.5',
    fast: 'deepseek v3.2',
    logical: 'kimi k2 thinking'
  };
  return judgeModels[judgeType] || judgeModels.logical; // Default to logical
}
```

### Session Flow with Judge Selection

```mermaid
graph TD
    A[User clicks "File a New Case"] --> B[Judge Selection Modal opens]
    B --> C[User selects judge type]
    C --> D[Modal closes, selected judge stored]
    D --> E[User clicks "File a New Case" again]
    E --> F[Serve action called with judge type]
    F --> G[Session created with selected judge]
    G --> H[Case proceeds with selected judge model]
```

## Testing Strategy

1. **UI Testing**:
   - Verify judge selection modal appears correctly
   - Test judge selection and confirmation
   - Ensure visual feedback for selected judge

2. **State Management Testing**:
   - Verify selected judge is stored in court store
   - Test persistence across page refreshes
   - Ensure default judge is used when none selected

3. **Server Integration Testing**:
   - Verify judge type is passed to server correctly
   - Test session creation with different judge types
   - Ensure model selection works for each judge type

4. **End-to-End Testing**:
   - Complete case flow with each judge type
   - Verify verdicts are generated with correct models
   - Test edge cases (no selection, invalid selection)

## Timeline

1. **Day 1**: UI component design and implementation
2. **Day 2**: Client-side state management integration
3. **Day 3**: Server-side model selection implementation
4. **Day 4**: Testing and bug fixing
5. **Day 5**: Final integration and deployment

## Risks and Mitigations

1. **Model Availability**: Ensure all selected models are available on OpenRouter
   - Mitigation: Add fallback to default model if selected model unavailable

2. **Performance Differences**: Different models may have different response times
   - Mitigation: Add loading indicators and set appropriate timeouts

3. **Cost Differences**: Different models may have different pricing
   - Mitigation: Add cost estimation display in judge selection UI

4. **User Confusion**: Users may not understand the differences between judges
   - Mitigation: Clear descriptions and tooltips for each judge type

## Success Criteria

1. Users can successfully select a judge before starting a case
2. Selected judge's model is used for verdict generation
3. Judge selection persists throughout the case
4. Default judge is used when no selection is made
5. All existing functionality remains intact
6. UI is intuitive and visually appealing