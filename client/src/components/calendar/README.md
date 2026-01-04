# Calendar Components

This directory contains the refactored calendar components extracted from the monolithic CalendarPage.jsx (originally 1,652 lines).

## Architecture Overview

The calendar feature has been decomposed into 6 focused components and 1 custom hook:

### Components

1. **CalendarGrid.jsx** (248 lines)
   - Main calendar grid with month navigation
   - Day cells with event indicators
   - Handles date selection and month navigation
   - Props: `currentDate`, `events`, `selectedDate`, `onDateSelect`, `onMonthNavigate`

2. **EventList.jsx** (215 lines)
   - Exports `EventCard` component
   - Displays individual event cards with timing info
   - Shows plan button for AI event planning
   - Supports both shared and secret events
   - Props: `event`, `delay`, `onClick`, `onPlanClick`, `showPlanButton`, `hasSavedPlan`

3. **EventForm.jsx** (272 lines)
   - Modal form for creating/editing events
   - Event type selection, emoji picker
   - Secret/shared visibility toggle
   - Date validation with error handling
   - Props: `selectedDate`, `onAdd`, `onClose`

4. **EventDetailsModal.jsx** (169 lines)
   - Shows details for events on a selected date
   - Delete functionality (only for user-created events)
   - Add more events to same date
   - Props: `events`, `onDelete`, `onClose`, `onAddMore`, `currentUserId`, `myDisplayName`, `partnerDisplayName`

5. **EventPlanningDialog.jsx** (493 lines)
   - AI-powered event planning modal
   - RAG-enhanced suggestions using couple's memory
   - Multiple style options (cozy, playful, fancy, low_key)
   - Interactive checklist with persistent state
   - Props: `event`, `eventKey`, `myId`, `partnerId`, `partnerDisplayName`, `myDisplayName`, `onClose`, `onSaved`

6. **UpcomingEvents.jsx** (177 lines)
   - Displays upcoming events (next 7 days)
   - Integrates with plan existence check
   - Empty state when no upcoming events
   - Props: `events`, `partnerId`, `isGold`, `onEventClick`, `onPlanClick`

### Custom Hook

7. **useCalendarEvents.js** (194 lines)
   - Encapsulates all calendar data logic
   - Fetches events from API
   - Manages default holidays and personal events (birthdays, anniversaries)
   - CRUD operations: `addEvent`, `deleteEvent`, `refetchEvents`
   - Returns: `{ events, isLoading, addEvent, deleteEvent, refetchEvents }`

## CalendarPage.jsx Refactoring

**Before:** 1,652 lines (monolithic)
**After:** 200 lines (orchestration layer)

**Reduction:** 88% smaller (1,452 lines extracted into focused components)

The new CalendarPage.jsx acts as a thin orchestration layer that:
- Imports all calendar components
- Manages top-level UI state (modals, selected dates)
- Handles event callbacks and subscription checks
- Delegates rendering to specialized components

## Component Communication

```
CalendarPage (orchestrator)
├── useCalendarEvents (data hook)
├── CalendarGrid (month view)
├── UpcomingEvents (7-day list)
│   └── EventCard (individual event)
├── EventForm (create/edit modal)
├── EventDetailsModal (view/delete modal)
└── EventPlanningDialog (AI planning modal)
```

## Testing

Each component has corresponding test files:
- `useCalendarEvents.test.js` - Hook logic tests
- `CalendarGrid.test.jsx` - Grid rendering and navigation
- `EventForm.test.jsx` - Form validation and submission
- `EventDetailsModal.test.jsx` - Event details and deletion

**Test Coverage:** 4 test files with comprehensive coverage of core functionality

## Design Principles Applied

1. **Single Responsibility** - Each component has one clear purpose
2. **Props over Context** - Explicit data flow via props
3. **Controlled Components** - Parent controls state when possible
4. **Composition** - Components compose together cleanly
5. **Separation of Concerns** - Data logic in hook, UI in components

## Usage Example

```jsx
import {
  useCalendarEvents,
  CalendarGrid,
  EventForm
} from '../components/calendar';

function MyCalendar() {
  const { events, addEvent } = useCalendarEvents(t);
  const [currentDate, setCurrentDate] = useState(new Date());

  return (
    <>
      <CalendarGrid
        currentDate={currentDate}
        events={events}
        onDateSelect={(date) => console.log(date)}
        onMonthNavigate={(dir) => setCurrentDate(...)}
      />
      <EventForm
        selectedDate={new Date()}
        onAdd={addEvent}
        onClose={() => {}}
      />
    </>
  );
}
```

## Key Features Preserved

- All calendar functionality (grid, events, planning) ✅
- Zustand store integrations (useAuthStore, useAppStore) ✅
- Framer Motion animations ✅
- Mobile responsiveness ✅
- Dark mode support ✅
- i18n (translation keys) ✅
- Secret vs shared events ✅
- AI event planning with RAG ✅
- Subscription/paywall integration ✅

## Migration Notes

- Zero breaking changes
- All existing functionality preserved
- Improved maintainability and testability
- Easier to add new features (e.g., new event types, planning styles)
- Components can be reused in other parts of the app

## Future Improvements

Potential enhancements made easier by this architecture:
- Add event editing (currently only create/delete)
- Support for time-based events (not just all-day)
- Recurring event patterns beyond yearly
- Event categories and filtering
- Calendar export/sync
- Collaborative event planning
