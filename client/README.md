# Pause 🐱⚖️

A fun, whimsical relationship app where **Judge Whiskers** (a wise cat judge) helps couples resolve their everyday disputes with humor and helpful insights.

## Features

- 🐱 **Courtroom** - Present your case to Judge Whiskers
- ⚖️ **AI Verdicts** - Get fair, fun, and thoughtful judgments  
- 💬 **Daily Questions** - Deepen your connection
- 📅 **Shared Calendar** - Plan together
- 💕 **Appreciations** - Show love
- 🪙 **Kibble Economy** - Earn & spend rewards

---

## Color Scheme

### Primary Colors
| Name | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| **Court Gold** | `#C9A227` | `--color-gold` | Primary buttons, accents, focus |
| **Deep Gold** | `#8B7019` | `--color-gold-dark` | Gradient endpoints |
| **Maroon** | `#722F37` | `--color-maroon` | Secondary buttons |
| **Maroon Light** | `#8B4049` | `--color-maroon-light` | Gradient highlights |

### Background & Neutral Colors
| Name | Hex | Usage |
|------|-----|-------|
| **Warm Cream** | `#FAF7F2` | Main background |
| **Tan Light** | `#F5EDE0` | Background gradient mid |
| **Tan Medium** | `#E8DFD0` | Background gradient low |
| **Scrollbar Tan** | `#D4C4A8` | Scrollbar, borders |
| **Brown Text** | `#4A3728` | Primary text color |

### Standard Gradients

```css
/* Primary Gold Button */
background: linear-gradient(135deg, #C9A227 0%, #8B7019 100%);

/* Text Gradient */
background: linear-gradient(135deg, #C9A227 0%, #8B7019 50%, #722F37 100%);

/* App Background */
background: linear-gradient(145deg, #FAF7F2 0%, #F5EDE0 40%, #E8DFD0 70%, #FAF7F2 100%);

/* Secondary Maroon Button */
background: linear-gradient(135deg, #722F37 0%, #8B4049 100%);
```

---

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion
- **Backend**: Express.js, Supabase
- **AI**: OpenAI / OpenRouter for Judge Whiskers' verdicts
- **Mobile**: Capacitor (iOS/Android)

---

## Development

```bash
# Install dependencies
npm run install:all

# Run dev server (client + server)
npm run dev

# Build for production
cd client && npm run build
```

## Mobile Build (Capacitor)

```bash
cd client
npm run build
npx cap sync
npx cap open ios      # Open Xcode
npx cap open android  # Open Android Studio
```
