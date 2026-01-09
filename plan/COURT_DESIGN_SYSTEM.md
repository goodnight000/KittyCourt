# Court Pages Design System

## Overview
This document establishes the design principles and color philosophy for the Pause app's court pages. The goal is to create a cohesive, premium, cute, and emotionally supportive UI that guides couples through the dispute resolution process.

## Color Philosophy

### Primary Palette (Court Theme)
The court pages use a warm, inviting palette inspired by a cozy courtroom aesthetic:

| Color | Hex | Purpose |
|-------|-----|---------|
| `court-gold` | `#D4AF37` | Primary accent, prestige, trust |
| `court-goldLight` | `#E6CFA3` | Champagne highlights, soft luxury |
| `court-goldDark` | `#B8972E` | Depth, sophisticated emphasis |
| `court-brown` | `#4A3728` | Primary text, gravitas |
| `court-brownLight` | `#6B5344` | Secondary text, warmth |
| `court-cream` | `#FFFBF5` | Warm backgrounds |
| `court-tan` | `#E6D5C3` | Soft borders, backgrounds |
| `court-maroon` | `#8B4513` | Deep accent, repair theme |

### Semantic Colors
| Purpose | Color Choice | Rationale |
|---------|--------------|-----------|
| Success/Validation | Green (`green-100` to `green-600`) | Universally understood as positive |
| Love/Settlement | Rose/Pink (`rose-100` to `rose-500`) | Warmth, reconciliation |
| Growth/Reflection | Lavender (`lavender-100` to `lavender-400`) | Calm, introspective |
| Warning/Attention | Amber (`amber-100` to `amber-600`) | Gentle alert |

### Colors to AVOID
- **Navy blue gradients** (`#1c1c84`, `#000035`) - Too cold, "AI design" feel
- **Purple gradients** - Overused AI aesthetic
- **Bright saturated colors** - Clash with warm palette
- **Gray/cool neutrals** - Feel clinical, not supportive

## Component Design Principles

### 1. Primary CTA Buttons
**Replace this:**
```css
/* OLD - Cold and disconnected */
background: linear-gradient(135deg, #1c1c84 0%, #000035 100%);
```

**With this:**
```css
/* NEW - Warm and premium */
background: linear-gradient(135deg, #D4AF37 0%, #B8972E 100%);
/* or for maroon variant */
background: linear-gradient(135deg, #8B4513 0%, #6B4423 100%);
```

**Implementation pattern:**
```jsx
<motion.button
  className="w-full py-3 px-4 rounded-xl text-white font-extrabold
             flex items-center justify-center gap-2
             bg-gradient-to-br from-court-gold to-court-goldDark
             shadow-lg disabled:opacity-50"
>
```

### 2. Glass Cards
Use the existing `glass-card` utility class with warm gradients:
```jsx
<div className="glass-card p-4 bg-gradient-to-br from-court-cream to-court-tan/30">
```

### 3. Journey Progress Bar
Keep the current stepper but ensure:
- Active step: `bg-court-gold`
- Completed step: `bg-green-500/80`
- Future step: `bg-court-tan/40`

### 4. Floating Decorative Elements
Use sparingly to add delight without overwhelming:
- Gold stars (`text-court-gold`)
- Lavender accents (`text-lavender-300`)
- Blush hearts for love themes (`text-blush-300`)

### 5. Modal Design
- Background: `bg-white/95` or `bg-white`
- Rounded corners: `rounded-3xl`
- Soft shadows: `shadow-2xl` or `shadow-soft-lg`
- Accent glows: Soft blurred shapes in corners

## Component-Specific Guidelines

### EvidenceForm
- Submit button: Warm gold gradient
- Textarea: `border-court-tan/30`, focus ring `court-gold`
- Settlement button: Keep rose/pink theme

### PrimingPage, JointMenuPage, ResolutionSelectPage
- Continue/Confirm buttons: Warm gold gradient
- Keep existing card structure (already good)
- Journey stepper: Already correctly styled

### VerdictView
- Accept button: Warm gold or maroon gradient
- Addendum button: Keep as ghost/outline style
- Sections: Keep existing semantic colors (green for purr, gold for hiss)

### SummonsReceived
- Join button: Verify `btn-primary` class uses correct color
- Add subtle floating elements for premium feel

### CaseDetailPage
- Improve information density with better section breaks
- Use collapsible sections consistently
- Timeline visualization: Court gold accents

## Animation Guidelines

### Micro-interactions
- Button press: `whileTap={{ scale: 0.98 }}`
- Card hover: `whileHover={{ scale: 1.01 }}`
- Loading: Smooth rotation, not bouncy

### Page Transitions
- Stagger animations for cards (delay: 0.05-0.1s increments)
- Fade + slide up for content sections

### Waiting States
- Gentle pulsing (not aggressive)
- Rotating elements at slow pace (8-20s duration)
- Floating elements with ease-in-out

## Typography

- Display font: `font-display` (Quicksand)
- Body font: `font-sans` (Nunito)
- Headings: `font-bold` or `font-extrabold`
- Labels: `text-[10px] uppercase tracking-wide`

## Implementation Priority

1. **High Priority**: Fix all CTA buttons using navy gradient
   - `CourtroomPage.jsx` (EvidenceForm, AddendumModal)
   - `PrimingPage.jsx`
   - `JointMenuPage.jsx`
   - `ResolutionSelectPage.jsx`
   - `VerdictView.jsx`

2. **Medium Priority**: Enhance premium feel
   - `SummonsReceived.jsx`
   - `CaseDetailPage.jsx`

3. **Low Priority**: Already well-designed
   - `CourtAtRest.jsx`
   - `DeliberatingScreen.jsx`
   - `WaitingForPartner.jsx`
   - `WaitingForEvidence.jsx`
   - `SettleModal.jsx`
