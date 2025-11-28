# Cat Judge - AI Coding Instructions

## Architecture Overview

Cat Judge is a **couples dispute resolution app** with a playful cat judge theme. It's a monorepo with:

- **`client/`** - React 19 + Vite SPA (mobile-first PWA design)
- **`server/`** - Express 5 API with Prisma ORM + SQLite

**Core Flow**: Two users (User A/B) submit their side of a dispute → Cat Judge delivers a humorous verdict → Kibble (virtual currency) is awarded.

## Development Commands

```bash
# Root - run both client and server concurrently
npm run dev

# Client only (localhost:5173)
cd client && npm run dev

# Server only (localhost:3000)
cd server && npm run dev

# Tests (client only, uses Vitest)
cd client && npm test
```

## Key Patterns

### State Management (Zustand)
All app state lives in `client/src/store/useAppStore.js`. Uses `persist` middleware for localStorage. Key state:
- `currentUser` / `users` - User switching (each user has separate `kibbleBalance`)
- `activeCase` - Current dispute with status flow: `DRAFT → LOCKED_A → DELIBERATING → RESOLVED`
- Actions are async and call the API service

```javascript
// Pattern: Always destructure from hook
const { currentUser, updateCaseInput, submitSide, redeemCoupon } = useAppStore();
```

### Component Conventions
- **Pages**: `client/src/pages/` - Full page components, use Framer Motion for transitions
- **Components**: `client/src/components/` - Reusable UI with JSDoc props
- All components use **functional style with hooks**, no class components

### Styling System
Uses Tailwind CSS 4 with custom theme in `index.css`:
- **`glass-card`** - Primary card style (glassmorphism with blur)
- **`text-gradient`** - Pink/violet/amber gradient text
- **`btn-primary`** - Gradient button with shadow
- Custom pastel palette: `blush`, `lavender`, `cream`, `mint`, `peach` (see `tailwind.config.js`)

```jsx
// Pattern: Use glass-card class or GlassCard component
<div className="glass-card p-4">...</div>
<GlassCard variant="gradient" accent="pink">...</GlassCard>
```

### Animation Pattern
Framer Motion is used extensively. Standard pattern:
```jsx
<motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 }}
>
```

### Modal Z-Index Pattern
Modals must use `z-[60]` to appear above the bottom dock (which uses `z-40`). Add `pb-20` padding to avoid dock overlap:
```jsx
<motion.div className="fixed inset-0 z-[60] flex items-end justify-center p-4 pb-20">
```

### API Layer
- `client/src/services/api.js` - Axios instance pointing to `localhost:3000/api`
- Server endpoints: `/api/users`, `/api/cases`, `/api/economy/transaction`
- Verdicts are stored as JSON strings in the database

### localStorage Patterns
Per-user data is stored with user ID in the key:
- `catjudge_rewards_${userId}` - Custom rewards each user offers to their partner
- `dailyMeow_${dateString}_${userId}` - Daily question answers

### Database Schema (Prisma)
Three models in `server/prisma/schema.prisma`:
- `User` - has `kibbleBalance` for economy
- `Case` - stores both sides' input, feelings, verdict, status
- `Transaction` - EARN/SPEND records for kibble

### Testing
Vitest with React Testing Library. Tests mock the API and reset Zustand state:
```javascript
beforeEach(() => {
    useAppStore.setState({ /* reset state */ });
});
```

Test cases for the Cat Judge AI are in `test-cases.json` at the project root.

## Utility Functions
`client/src/utils/helpers.js`:
- `cn()` - clsx + tailwind-merge for conditional classes
- `formatKibble()` - Number formatting
- `getVibeEmoji()` - Score-based emoji selection

## Mobile-First Considerations
- Uses `dvh` units for viewport height
- Safe area padding classes (`safe-top`, `safe-bottom`)
- Touch-optimized with `whileTap` animations
- Fixed bottom nav bar in `MainLayout.jsx` - constrained to `max-w-lg` and centered
