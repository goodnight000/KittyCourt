# Push Notifications (Firebase/FCM)

This app uses Capacitor push notifications + Firebase Cloud Messaging (FCM).

There are two parts:

- Client (iOS/Android): obtains an FCM registration token and stores it in Supabase (`device_tokens`).
- Server (Fly): uses Firebase Admin SDK to send pushes to those FCM tokens.

## Server (Fly.io) – Firebase Admin creds

Set these Fly secrets (from a Firebase **Service Account** JSON):

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (keep the `\n` newlines; the server converts `\\n` → real newlines)

Recommended:

- Do **not** use `FIREBASE_SERVICE_ACCOUNT_PATH` on Fly (there is no JSON file inside the container unless you explicitly add one).

## iOS (FCM) setup

## Supabase OAuth (Google) on iOS/Android

Native OAuth uses a custom URL scheme redirect.

Add these URLs in Supabase Dashboard → Authentication → URL Configuration → **Redirect URLs**:

- `com.midnightstudio.pause://auth/callback`
- `com.midnightstudio.pause://reset-password`

Then ensure your Google provider is enabled in Supabase (Authentication → Providers → Google).

### 1) Create / configure iOS app in Firebase

Firebase Console → Project Settings → General → “Your apps”:

- Add an **iOS app** (or open existing).
- Bundle ID must match the app’s bundle identifier (e.g. `com.midnightStudio.pause`).
- Download `GoogleService-Info.plist`.

Add the plist to Xcode:

- Put it at `client/ios/App/App/GoogleService-Info.plist`
- Ensure it’s added to the **App** target (Build Phases → Copy Bundle Resources)

Do not commit the plist if you treat it as environment-specific.

### 2) Enable APNs for FCM

FCM on iOS requires APNs credentials in Firebase.

Apple Developer → Certificates, Identifiers & Profiles → Keys:

- Create an **APNs Auth Key** (or use an existing one).
- Download the `.p8` file and note:
  - Key ID
  - Team ID

Firebase Console → Project Settings → Cloud Messaging:

- Upload the APNs Auth Key (`.p8`), enter Key ID + Team ID.
- Make sure the bundle ID matches the iOS app you added.

### 3) Xcode capabilities

In Xcode, for the **App** target:

- Signing & Capabilities → add **Push Notifications**
- Signing & Capabilities → add **Background Modes** → enable **Remote notifications**

### 4) Install the Capacitor Firebase Messaging plugin

From `client/`:

```bash
npm i @capacitor-firebase/messaging
npx cap sync ios
```

Then rebuild/run the iOS app.

## Android note (required for Android FCM)

Ensure `client/android/app/google-services.json` matches the Android `applicationId`.
