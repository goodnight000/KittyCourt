# Pause (formerly Cat Judge) 🐾

**Resolve conflicts with purr-sonality.**

Pause is a relationship wellness app that uses a cute, cat-themed interface to help couples resolve conflicts, build intimacy, and have fun together. At the heart of the app is **Judge Whiskers**, an AI mediator who dispenses fair, impartial, and undeniably cute verdicts.

## 🌟 Key Features

### ⚖️ **The Court of Judge Whiskers**
-   **Submit a Case**: Couples can submit their disagreements to Judge Whiskers.
-   **AI Mediation**: Uses advanced LLMs to analyze both sides and deliver a "purr-dict" that validates feelings while offering a constructive resolution.
-   **Hiss-tory**: Keep track of past cases and resolutions.

### 📅 **Daily Meow**
-   **Daily Questions**: Fun, deep, or silly questions to answer every day.
-   **Mood Tracking**: Track your daily emotional state with custom cat avatars (Happy, Playful, Cozy, etc.).
-   **Streaks**: Build a question streak together.

### 💰 **Kibble Economy**
-   **Earn Kibble**: Get rewarded for good communication, resolving cases, and daily engagement.
-   **Marketplace**: Spend Kibble on real-life rewards (e.g., "Massage Coupon", "Date Night Choice", "Dish Duty Pass").

### 🗓️ **Shared Calendar**
-   **Couples Planning**: Plan dates, track anniversaries, and manage shared commitments.
-   **AI Suggestions**: Get personalized date ideas based on your partner's love language and preferences.

### 🎨 **Premium Aesthetic**
-   **Whimsical Design**: A beautiful, premium interface featuring glassmorphism, soft gradients, and delightful animations.
-   **Dynamic Island Support**: Optimized for modern mobile displays.

---

## 🛠️ Tech Stack

### **Frontend (Client)**
-   **React**: Core UI framework.
-   **Vite**: Fast build tool.
-   **Tailwind CSS**: Utility-first styling with custom "Court" color palette.
-   **Framer Motion**: Smooth, spring-based animations.
-   **Lucide React**: Beautiful icons.
-   **Zustand**: Global state management.

### **Backend (Server & Database)**
-   **Node.js & Express**: API server for LLM interactions.
-   **Supabase**:
    -   **PostgreSQL**: Primary database for user data, profiles, and relationships.
    -   **Auth**: Secure user authentication.
    -   **Storage**: For profile pictures and assets.
    -   **Realtime**: Live updates for cases and chat.
-   **OpenAI / Grok**: LLM integration for Judge Whiskers' logic.

### **Mobile (Native)**
-   **Capacitor**: Cross-platform runtime to deploy the web app to iOS and Android.

---

## 🚀 Getting Started

### Prerequisites
-   **Node.js** (v18+)
-   **npm** or **yarn**
-   **Java 17** (Required for Android builds)
-   **Xcode** (Required for iOS builds, macOS only)
-   **Android Studio** (Required for Android builds)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/goodnight000/KittyCourt.git
    cd KittyCourt
    ```

2.  **Install Dependencies**
    ```bash
    # Install server dependencies
    cd server
    npm install

    # Install client dependencies
    cd ../client
    npm install
    ```

3.  **Environment Variables**
    Create a `.env` file in `client` and `server` directories based on `.env.example`.
    
    **Client (.env):**
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    VITE_API_URL=http://localhost:3000/api
    ```

    **Server (.env):**
    ```env
    PORT=3000
    OPENAI_API_KEY=your_openai_key
    SUPABASE_URL=your_supabase_url
    SUPABASE_SERVICE_KEY=your_service_role_key
    ```

### Running the App

1.  **Start the Backend Server**
    ```bash
    cd server
    npm run dev
    ```

2.  **Start the Client (Web)**
    ```bash
    cd client
    npm run dev
    ```
    Access the app at `http://localhost:5173`.

### Mobile Development

To run on native simulators:

**iOS:**
```bash
cd client
npx cap sync ios
npx cap open ios
```

**Android:**
```bash
cd client
npx cap sync android
npx cap open android
```

---

## 📂 Project Structure

```
KittyCourt/
├── client/                 # React Frontend
│   ├── android/            # Android native project
│   ├── ios/                # iOS native project
│   ├── public/             # Static assets (images, sounds)
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── layouts/        # Page layouts
│       ├── pages/          # Application screens
│       ├── services/       # API and Supabase clients
│       ├── store/          # Zustand state stores
│       └── utils/          # Helper functions
├── server/                 # Node.js Express Backend
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   └── lib/            # Logic for Judge Whiskers & Memory
│   └── prisma/             # (Legacy) Database schema reference
└── supabase/               # Supabase migrations and config
```

## 📄 License
Property of Goodnight Inc. All rights reserved.
