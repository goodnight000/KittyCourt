# Pause App - Notifications Implementation Plan

## Executive Summary

Push notifications are **critical** for couple engagement in Pause. Currently, users only receive updates when the app is open (via Socket.IO/Supabase Realtime). This plan implements cross-platform push notifications using **Firebase Cloud Messaging (FCM) + Supabase**.

**Cost:** $0/month (Firebase FCM is completely free with no limits)

**Stack:**
- **Client:** `@capacitor/push-notifications` (already installed, Capacitor 7.x native)
- **Server:** `firebase-admin` (Node.js SDK)
- **Database:** Supabase (device tokens, preferences, logs)

---

## Current State Analysis

| Component | Status | Notes |
|-----------|--------|-------|
| Socket.IO | Exists | Real-time for active court sessions only |
| Supabase Realtime | Exists | In-app only (partner requests, daily answers) |
| Push Plugin | **Installed** | `@capacitor/push-notifications@7.0.4` |
| Firebase Admin | **Pending** | Need `firebase-admin` on server |
| Device Token DB | **Done** | `037_push_notifications.sql` created |
| Notification API | **Pending** | Need /api/notifications/* endpoints |

### Existing Real-Time Infrastructure

**Socket.IO (Court Sessions):**
- Location: `server/src/lib/courtWebSocket.js`
- Client: `client/src/hooks/useCourtSocket.js`
- Handles: User registration, court actions, real-time sync
- Limitation: Only works when app is open

**Supabase Realtime:**
- Location: `client/src/services/supabase.js`
- Subscriptions: `subscribeToPartnerRequests()`, `subscribeToProfileChanges()`, `subscribeToDailyAnswers()`
- Limitation: In-app only, no background delivery

---

## Notification Types (Prioritized)

### Tier 1 - Critical (Must Have)

| Notification | Trigger Location | Who Receives | Data Needed |
|--------------|------------------|--------------|-------------|
| **Court Summons** | `courtSessionManager.js:serve()` | Partner | sessionId, creatorName |
| **Verdict Ready** | `verdictGenerator.js` | Both users | sessionId, judgeName |
| **Evidence Submitted** | `courtSessionManager.js:submitEvidence()` | Partner | sessionId |
| **Daily Question Reminder** | Scheduled job | Users who haven't answered | questionId |
| **Partner Connected** | `useAuthStore.js:acceptRequest()` | Both users | partnerName, anniversaryDate |

### Tier 2 - Important (Should Have)

| Notification | Trigger Location | Who Receives | Data Needed |
|--------------|------------------|--------------|-------------|
| **Appreciation Received** | `appreciations.js:POST /` | Recipient | message, kibbleAmount, senderName |
| **Partner Answered Daily Q** | `dailyQuestions.js:POST /answer` | Partner | questionPreview |
| **Settlement Request** | `courtSessionManager.js:requestSettlement()` | Partner | sessionId |
| **Settlement Accepted/Declined** | `courtSessionManager.js:acceptSettlement()` | Partner | sessionId, outcome |
| **Challenge Completion Request** | `challenges.js:POST /:id/complete` | Partner | challengeTitle |
| **Challenge Confirmed** | `challenges.js:POST /:id/confirm` | Both users | challengeTitle, xpAmount |

### Tier 3 - Nice to Have

| Notification | Trigger | Who Receives |
|--------------|---------|--------------|
| **Level Up** | XP threshold crossed | Both users |
| **New Daily Question** | Daily reset (scheduled) | Both users |
| **Weekly Streak** | 7-day question streak | Both users |
| **Anniversary Reminder** | Upcoming anniversary | Both users |
| **Inactivity Reminder** | No engagement for 3+ days | Both users |
| **Kibble Milestone** | 100/500/1000 kibble earned | Both users |

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Capacitor)                       │
├─────────────────────────────────────────────────────────────────┤
│  pushNotifications.js                                            │
│  ├── Initialize @capacitor/push-notifications                    │
│  ├── Request permissions                                         │
│  ├── Save FCM token to Supabase                                  │
│  ├── Handle foreground/background notifications                  │
│  └── Deep link routing                                           │
└────────────────────────────────┬────────────────────────────────┘
                                 │ FCM Token (saved to Supabase)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SUPABASE (Database)                        │
├─────────────────────────────────────────────────────────────────┤
│  device_tokens ─────────────────► Stores FCM/APNs tokens         │
│  notification_preferences ──────► User notification settings     │
│  notification_log ──────────────► Delivery tracking              │
│  should_send_notification() ────► Check preferences + quiet hrs  │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Query tokens
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SERVER (Express.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  firebaseService.js ───────────► Firebase Admin SDK              │
│  notificationService.js ───────► High-level notification logic   │
│  Trigger points in:                                              │
│    - courtSessionManager.js                                      │
│    - appreciations.js                                            │
│    - dailyQuestions.js                                           │
│    - challenges.js                                               │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Firebase Admin SDK
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       FIREBASE CLOUD MESSAGING                   │
├─────────────────────────────────────────────────────────────────┤
│  iOS ──────► APNs (via FCM)                                     │
│  Android ──► FCM (direct)                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Infrastructure Setup (CURRENT)

**Skills to reference:** `.codex/skills/api-design-principles`, `.codex/skills/sql-optimization-patterns`

#### 1.1 Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project named "Pause" (or use existing)
3. Enable Cloud Messaging
4. Download service account key JSON file

**iOS Configuration:**
1. In Firebase Console → Project Settings → Cloud Messaging
2. Upload APNs Authentication Key (.p8) or APNs Certificate (.p12)
3. Add your iOS bundle ID

**Android Configuration:**
1. Download `google-services.json` from Firebase Console
2. Place in `client/android/app/google-services.json`

#### 1.2 Install Dependencies

**Server:**
```bash
cd server
npm install firebase-admin --save
```

**Client:** Already installed - `@capacitor/push-notifications@7.0.4`

#### 1.3 Database Migration (DONE)

Migration created at `supabase/migrations/037_push_notifications.sql`:

```sql
-- Tables created:
--   • device_tokens (stores FCM/APNs tokens)
--   • notification_preferences (user settings)
--   • notification_log (delivery tracking)
--
-- Functions:
--   • should_send_notification(user_id, type) - Check preferences + quiet hours
--
-- Triggers:
--   • Auto-creates notification_preferences on profile creation
```

#### 1.4 Environment Variables

**Server (.env):**
```bash
# Firebase Configuration (path to service account JSON)
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
# OR use inline credentials:
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="your_private_key"
```

#### 1.5 Cleanup Old Dependencies

Remove OneSignal packages that were previously installed:
```bash
cd client
npm uninstall onesignal-cordova-plugin @onesignal/node-onesignal
cd ../server
npm uninstall @onesignal/node-onesignal
```

---

### Phase 2: Client-Side Implementation

**Skills to reference:** `.codex/skills/react-state-management`, `.codex/skills/frontend-design`

#### 2.1 Create Push Notifications Service

Create `client/src/services/pushNotifications.js`:

```javascript
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';

/**
 * Initialize push notifications for the app
 * Should be called after user authentication
 */
export const initializePushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[Push] Not a native platform, skipping initialization');
    return;
  }

  // Check current permission status
  const permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    // Request permission
    const result = await PushNotifications.requestPermissions();
    if (result.receive !== 'granted') {
      console.log('[Push] Permission denied');
      return;
    }
  } else if (permStatus.receive !== 'granted') {
    console.log('[Push] Permission not granted:', permStatus.receive);
    return;
  }

  // Register for push notifications
  await PushNotifications.register();

  // Set up listeners
  setupPushListeners();
};

/**
 * Set up all push notification event listeners
 */
const setupPushListeners = () => {
  // Token received - save to database
  PushNotifications.addListener('registration', async (token) => {
    console.log('[Push] Registration token:', token.value);
    await saveDeviceToken(token.value);
  });

  // Registration error
  PushNotifications.addListener('registrationError', (error) => {
    console.error('[Push] Registration error:', error);
  });

  // Notification received while app is in foreground
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[Push] Foreground notification:', notification);
    // Optionally show in-app notification UI
    handleForegroundNotification(notification);
  });

  // Notification tapped (app opened from notification)
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[Push] Notification action:', action);
    handleNotificationNavigation(action.notification.data);
  });
};

/**
 * Save device token to Supabase
 */
const saveDeviceToken = async (token) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('[Push] No user logged in, cannot save token');
    return;
  }

  const platform = Capacitor.getPlatform(); // 'ios' or 'android'

  const { error } = await supabase.from('device_tokens').upsert({
    user_id: user.id,
    token: token,
    platform: platform,
    active: true,
    last_used_at: new Date().toISOString(),
  }, {
    onConflict: 'token',
    ignoreDuplicates: false
  });

  if (error) {
    console.error('[Push] Error saving token:', error);
  } else {
    console.log('[Push] Token saved successfully');
  }
};

/**
 * Handle foreground notification display
 */
const handleForegroundNotification = (notification) => {
  // You can show a toast/snackbar here
  // Or use a notification library to display in-app
  console.log('[Push] Foreground notification data:', notification.data);
};

/**
 * Handle navigation when notification is tapped
 */
const handleNotificationNavigation = (data) => {
  if (!data) return;

  const screen = data.screen || data.type;

  switch (screen) {
    case 'courtroom':
    case 'court_session':
      window.location.href = '/courtroom';
      break;
    case 'case_detail':
    case 'verdict':
      window.location.href = data.case_id
        ? `/history/${data.case_id}`
        : '/history';
      break;
    case 'appreciations':
    case 'appreciation':
      window.location.href = '/appreciations';
      break;
    case 'daily_meow':
    case 'daily_question':
      window.location.href = '/daily-meow';
      break;
    case 'challenges':
    case 'challenge':
      window.location.href = '/challenges';
      break;
    default:
      window.location.href = '/';
  }
};

/**
 * Deactivate device token on logout
 */
export const deactivateDeviceToken = async () => {
  if (!Capacitor.isNativePlatform()) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Mark all tokens for this user as inactive
  await supabase
    .from('device_tokens')
    .update({ active: false })
    .eq('user_id', user.id);
};

/**
 * Remove all listeners (call on app cleanup)
 */
export const removePushListeners = async () => {
  await PushNotifications.removeAllListeners();
};
```

#### 2.2 Integration Points

**App.jsx:**
```javascript
import { useEffect } from 'react';
import { initializePushNotifications } from './services/pushNotifications';
import useAuthStore from './store/useAuthStore';

function App() {
  const { user } = useAuthStore();

  useEffect(() => {
    // Initialize push notifications after user is authenticated
    if (user) {
      initializePushNotifications();
    }
  }, [user]);

  // ... rest of app
}
```

**useAuthStore.js:**
```javascript
import { deactivateDeviceToken } from '../services/pushNotifications';

// In signOut action:
signOut: async () => {
  await deactivateDeviceToken(); // Deactivate push token
  await supabase.auth.signOut();
  set({ user: null, profile: null, partner: null });
}
```

---

### Phase 3: Server-Side Implementation

**Skills to reference:** `.codex/skills/api-design-principles`

#### 3.1 Create Firebase Service

Create `server/src/services/firebaseService.js`:

```javascript
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseApp = null;

function initializeFirebase() {
  if (firebaseApp) return firebaseApp;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (serviceAccountPath) {
    // Use service account file
    const serviceAccount = require(serviceAccountPath);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Use environment variables
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  console.log('[Firebase] Admin SDK initialized');
  return firebaseApp;
}

/**
 * Send push notification to specific device tokens
 * @param {Object} options
 * @param {string[]} options.tokens - FCM device tokens
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} options.data - Custom data payload
 * @returns {Promise<Object>} - Send result with success/failure counts
 */
async function sendPushNotification({ tokens, title, body, data = {} }) {
  if (!tokens || tokens.length === 0) {
    return { success: false, reason: 'no_tokens' };
  }

  initializeFirebase();

  const message = {
    notification: {
      title,
      body,
    },
    data: {
      ...data,
      // Ensure all values are strings (FCM requirement)
      ...Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    },
    // iOS specific settings
    apns: {
      payload: {
        aps: {
          badge: 1,
          sound: 'default',
        },
      },
    },
    // Android specific settings
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'pause_notifications',
      },
    },
  };

  try {
    if (tokens.length === 1) {
      // Single token
      const response = await admin.messaging().send({
        ...message,
        token: tokens[0],
      });
      return { success: true, messageId: response };
    } else {
      // Multiple tokens - use sendEachForMulticast
      const response = await admin.messaging().sendEachForMulticast({
        ...message,
        tokens,
      });
      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses,
      };
    }
  } catch (error) {
    console.error('[Firebase] Send error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if tokens are still valid and remove invalid ones
 * @param {string[]} tokens - Tokens to validate
 * @returns {Promise<string[]>} - Array of invalid tokens
 */
async function getInvalidTokens(tokens) {
  initializeFirebase();

  const invalidTokens = [];

  // Send a dry run to check validity
  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: 'test', body: 'test' },
    // Note: dryRun doesn't actually send
  }, true);

  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const errorCode = resp.error?.code;
      if (
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/registration-token-not-registered'
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }
  });

  return invalidTokens;
}

module.exports = {
  initializeFirebase,
  sendPushNotification,
  getInvalidTokens,
};
```

#### 3.2 Create Notification Service

Create `server/src/services/notificationService.js`:

```javascript
const { supabaseAdmin } = require('./supabase');
const { sendPushNotification, getInvalidTokens } = require('./firebaseService');

/**
 * Send notification to a specific user
 * Checks preferences, quiet hours, and handles token management
 * @param {string} userId - Target user ID
 * @param {Object} notification - Notification details
 * @param {string} notification.type - Notification type (for preferences)
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {Object} notification.data - Custom data payload
 * @returns {Promise<Object>} - Result with success status
 */
async function sendNotificationToUser(userId, notification) {
  try {
    // Check user preferences and quiet hours
    const { data: shouldSend, error: prefError } = await supabaseAdmin.rpc(
      'should_send_notification',
      {
        target_user_id: userId,
        notification_type: notification.type
      }
    );

    if (prefError) {
      console.error('[Notification] Preference check error:', prefError);
    }

    if (!shouldSend) {
      return { success: false, reason: 'user_preferences' };
    }

    // Get active device tokens for user
    const { data: tokenRecords, error: tokenError } = await supabaseAdmin
      .from('device_tokens')
      .select('id, token')
      .eq('user_id', userId)
      .eq('active', true);

    if (tokenError) {
      console.error('[Notification] Token fetch error:', tokenError);
      return { success: false, reason: 'token_error' };
    }

    if (!tokenRecords || tokenRecords.length === 0) {
      return { success: false, reason: 'no_tokens' };
    }

    const tokens = tokenRecords.map(t => t.token);

    // Send via Firebase
    const result = await sendPushNotification({
      tokens,
      title: notification.title,
      body: notification.body,
      data: {
        type: notification.type,
        ...notification.data,
      },
    });

    // Log notification attempt
    await supabaseAdmin.from('notification_log').insert({
      user_id: userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error || null,
    });

    // Handle invalid tokens (clean up)
    if (result.responses) {
      const invalidTokens = [];
      result.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      // Deactivate invalid tokens
      if (invalidTokens.length > 0) {
        await supabaseAdmin
          .from('device_tokens')
          .update({ active: false })
          .in('token', invalidTokens);
        console.log(`[Notification] Deactivated ${invalidTokens.length} invalid tokens`);
      }
    }

    return result;
  } catch (error) {
    console.error('[Notification] Send error:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Send notification to both users in a couple
 * @param {string} userAId - First user ID
 * @param {string} userBId - Second user ID
 * @param {Object} notification - Notification details
 */
async function sendNotificationToCouple(userAId, userBId, notification) {
  const results = await Promise.all([
    sendNotificationToUser(userAId, notification),
    sendNotificationToUser(userBId, notification),
  ]);

  return {
    userA: results[0],
    userB: results[1],
  };
}

/**
 * Send notification to a user's partner
 * @param {string} userId - The user whose partner should be notified
 * @param {Object} notification - Notification details
 */
async function sendNotificationToPartner(userId, notification) {
  // Get partner ID
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('partner_id')
    .eq('id', userId)
    .single();

  if (error || !profile?.partner_id) {
    return { success: false, reason: 'no_partner' };
  }

  return sendNotificationToUser(profile.partner_id, notification);
}

module.exports = {
  sendNotificationToUser,
  sendNotificationToCouple,
  sendNotificationToPartner,
};
```

---

### Phase 4: Notification Triggers

#### 4.1 Court Session Notifications

Update `server/src/lib/courtSessionManager.js`:

```javascript
const { sendNotificationToPartner } = require('../services/notificationService');

// In serve() method, after creating session:
await sendNotificationToPartner(creatorId, {
  type: 'court_session',
  title: 'Court Session Request',
  body: `${creatorName} wants to settle a dispute`,
  data: {
    screen: 'courtroom',
    sessionId: session.id
  },
});

// In submitEvidence() method:
await sendNotificationToPartner(userId, {
  type: 'evidence_submitted',
  title: 'Evidence Submitted',
  body: `Your partner has submitted their evidence`,
  data: {
    screen: 'courtroom',
    sessionId: sessionId
  },
});

// In requestSettlement() method:
await sendNotificationToPartner(requesterId, {
  type: 'settlement_request',
  title: 'Settlement Requested',
  body: `${requesterName} wants to settle outside court`,
  data: {
    screen: 'courtroom',
    sessionId: sessionId
  },
});
```

#### 4.2 Verdict Notification

In verdict generation flow:

```javascript
const { sendNotificationToCouple } = require('../services/notificationService');

// After verdict is generated:
await sendNotificationToCouple(userAId, userBId, {
  type: 'verdict',
  title: 'Verdict Ready',
  body: 'Judge Whiskers has delivered a verdict',
  data: {
    screen: 'case_detail',
    case_id: caseId
  },
});
```

#### 4.3 Appreciation Notification

Update `server/src/routes/appreciations.js`:

```javascript
const { sendNotificationToUser } = require('../services/notificationService');

// In POST / route, after creating appreciation:
await sendNotificationToUser(recipientId, {
  type: 'appreciation',
  title: 'New Appreciation',
  body: `${senderName} sent you an appreciation`,
  data: {
    screen: 'appreciations'
  },
});
```

#### 4.4 Daily Question Notification

Update `server/src/routes/dailyQuestions.js`:

```javascript
const { sendNotificationToPartner } = require('../services/notificationService');

// In POST /answer route, after saving answer:
await sendNotificationToPartner(userId, {
  type: 'daily_question',
  title: 'Your Partner Answered',
  body: `${userName} answered today's question`,
  data: {
    screen: 'daily_meow'
  },
});
```

#### 4.5 Challenge Notifications

Update `server/src/routes/challenges.js`:

```javascript
const { sendNotificationToPartner, sendNotificationToCouple } = require('../services/notificationService');

// When challenge completion is requested:
await sendNotificationToPartner(userId, {
  type: 'challenge_completion',
  title: 'Challenge Completed',
  body: `${userName} completed "${challengeTitle}"`,
  data: {
    screen: 'challenges',
    challengeId: challengeId
  },
});

// When challenge is confirmed:
await sendNotificationToCouple(userAId, userBId, {
  type: 'challenge_confirmed',
  title: 'Challenge Confirmed!',
  body: `You earned ${xpAmount} XP for "${challengeTitle}"`,
  data: {
    screen: 'challenges'
  },
});
```

#### 4.6 Partner Connected Notification

In partner connection flow:

```javascript
const { sendNotificationToUser } = require('../services/notificationService');

// After partner request is accepted:
await sendNotificationToUser(requesterId, {
  type: 'partner_connected',
  title: 'Partner Connected!',
  body: `${accepterName} accepted your partner request`,
  data: {
    screen: 'home'
  },
});
```

---

### Phase 5: Native Platform Setup

#### 5.1 iOS Setup

1. Open Xcode: `npx cap open ios`

2. Add Push Notifications capability:
   - Select your project → Signing & Capabilities
   - Click "+ Capability"
   - Add "Push Notifications"

3. Add Background Modes capability:
   - Add "Background Modes"
   - Check "Remote notifications"

4. In Firebase Console:
   - Go to Project Settings → Cloud Messaging → iOS app
   - Upload APNs Authentication Key (.p8) from Apple Developer Portal
   - Or upload APNs Certificate (.p12)

#### 5.2 Android Setup

1. Add `google-services.json`:
   - Download from Firebase Console
   - Place in `client/android/app/google-services.json`

2. Verify AndroidManifest.xml permissions (already included by Capacitor plugin):
   ```xml
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
   ```

3. Create notification channel in `MainActivity.java` or via plugin config

4. Add notification icons:
   - Create `res/drawable/ic_notification.png` (24x24dp, white/transparent)
   - Create `res/drawable/ic_notification_large.png` (optional, for expanded view)

#### 5.3 Sync Native Projects

```bash
cd client
npx cap sync
```

---

### Phase 6: Testing

**Skills to reference:** `.codex/skills/webapp-testing`

| Scenario | iOS | Android |
|----------|-----|---------|
| Permission request on first launch | [ ] | [ ] |
| Permission denied handling | [ ] | [ ] |
| Foreground notification (app open) | [ ] | [ ] |
| Background notification (app closed) | [ ] | [ ] |
| Notification tap → correct screen | [ ] | [ ] |
| Quiet hours respected | [ ] | [ ] |
| Per-type preferences respected | [ ] | [ ] |
| Token saved to database | [ ] | [ ] |
| Token deactivated on logout | [ ] | [ ] |
| Invalid token cleanup | [ ] | [ ] |

**Testing Commands:**

```bash
# Server tests
cd server
npm test -- notifications

# Client tests
cd client
npm test -- pushNotifications
```

---

## File Structure Summary

### New Files

```
server/
├── src/
│   └── services/
│       ├── firebaseService.js      # Firebase Admin SDK wrapper
│       └── notificationService.js   # High-level notification logic

client/
└── src/
    └── services/
        └── pushNotifications.js     # Capacitor push notifications

server/
└── firebase-service-account.json    # Firebase credentials (gitignored)

supabase/migrations/
└── 037_push_notifications.sql       # Database schema (DONE)
```

### Modified Files

```
server/src/lib/courtSessionManager.js  # Add notification triggers
server/src/routes/appreciations.js     # Add notification trigger
server/src/routes/dailyQuestions.js    # Add notification trigger
server/src/routes/challenges.js        # Add notification trigger
client/src/App.jsx                     # Initialize push notifications
client/src/store/useAuthStore.js       # Deactivate token on logout
server/.env                            # Add Firebase credentials
client/android/app/google-services.json # Firebase Android config
```

---

## Environment Variables

### Server (.env)

```bash
# Firebase Configuration - Option 1: Service Account File
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# Firebase Configuration - Option 2: Inline Credentials
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## Implementation Checklist

### Phase 1: Infrastructure (IN PROGRESS)
- [x] Create database migration (037_push_notifications.sql)
- [ ] Create Firebase project and enable Cloud Messaging
- [ ] Download Firebase service account key
- [ ] Install firebase-admin on server
- [ ] Remove old OneSignal packages (client & server)
- [ ] Configure iOS APNs in Firebase Console
- [ ] Add google-services.json to Android project

### Phase 2: Client
- [ ] Create pushNotifications.js service
- [ ] Integrate with App.jsx
- [ ] Integrate with useAuthStore (logout)
- [ ] Test permission flow

### Phase 3: Server
- [ ] Create firebaseService.js
- [ ] Create notificationService.js
- [ ] Add environment variables
- [ ] Test Firebase connection

### Phase 4: Triggers
- [ ] Court session notifications
- [ ] Evidence submitted notifications
- [ ] Verdict notifications
- [ ] Appreciation notifications
- [ ] Daily question notifications
- [ ] Challenge notifications
- [ ] Partner connected notifications

### Phase 5: Native
- [ ] iOS Push Notifications capability
- [ ] iOS Background Modes capability
- [ ] Android google-services.json
- [ ] Android notification icons
- [ ] Run npx cap sync

### Phase 6: Testing

**Automated Tests (Completed):**
- ✅ Client tests: 144 passed
- ✅ Server tests: 281 passed (6 pre-existing failures unrelated to notifications)

**Manual Testing Checklist:**

Prerequisites:
- [ ] Firebase project configured with FCM enabled
- [ ] APNs key uploaded to Firebase (iOS)
- [ ] GoogleService-Info.plist added to iOS project
- [ ] Push Notifications capability enabled in Xcode
- [ ] App built and deployed to physical device

Token Registration:
- [ ] iOS: Permission request on first auth
- [ ] Android: Token registered automatically after auth
- [ ] Token appears in `device_tokens` table with correct platform

Notification Types:
- [ ] Court session request → Partner notified, taps to /courtroom
- [ ] Evidence complete → Both notified, taps to /courtroom
- [ ] Settlement request → Partner notified, taps to /courtroom
- [ ] Appreciation sent → Recipient notified, taps to /appreciations
- [ ] Daily Meow complete → Both notified, taps to /daily-meow
- [ ] Challenge completion → Partner notified, taps to /challenges
- [ ] Challenge confirmed → Partner notified, taps to /challenges

Platform-Specific:
- [ ] iOS foreground: Custom event dispatched (pushNotificationReceived)
- [ ] iOS background: System notification displayed
- [ ] Android foreground: System notification displayed
- [ ] Android background: System notification displayed

Token Lifecycle:
- [ ] Token deactivated on sign out
- [ ] Token deactivated on session expiry
- [ ] Invalid tokens cleaned up after failed send

Preference Handling:
- [ ] User preferences respected (should_send_notification RPC)
- [ ] Quiet hours respected
- [ ] Disabled notification types not sent

---

## Cost Analysis

**Firebase Cloud Messaging:**
- Completely FREE
- No subscriber limits
- No message limits
- Includes analytics
- No credit card required

**Firebase Pricing:**
- FCM: Free forever
- Only pay for other Firebase services if used (Firestore, Functions, etc.)
- We only use FCM, so $0/month

---

## Success Metrics

1. **Notification opt-in rate** > 70%
2. **Notification click-through rate** > 25%
3. **Court session response time** reduced by 50%
4. **Daily question completion rate** increased by 30%
