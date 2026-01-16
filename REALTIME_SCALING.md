# Realtime (Socket.IO) Scaling Notes

This repo currently works well as a **single Node/Express instance** (one process), but **horizontal scaling and/or multi-region is not “free”** for realtime systems. This doc explains why, what the current design is doing, and what changes make your scaling goals achievable.

## What we’re trying to do

- Support ~**2k concurrent** Socket.IO clients (growing to ~**6k**).
- Eventually support **US + Asia** deployment (Europe later).
- Keep the system reliable: realtime updates deliver to the right users, and session state transitions don’t run multiple times.

## Current system (how it works today)

### Realtime transport

- The client keeps a persistent Socket.IO connection alive across navigation:
  - `client/src/layouts/MainLayout.jsx` calls `useCourtSocket()`.
  - `client/src/hooks/useCourtSocket.js` decides the socket origin (local in dev, `VITE_API_URL` in prod).

### Socket routing model (important)

- The server tracks which sockets belong to which user **in memory**:
  - `server/src/lib/courtWebSocket.js` stores `userSockets = Map<userId, Set<socketId>>`.
  - `emitToUser(userId, ...)` looks up socket IDs **only inside this process** and emits to those sockets.

### Court session state model (also important)

- Court session state is stored in-process (via a repository), with optional Redis mirroring:
  - `server/src/lib/court/SessionStateRepository.js` stores sessions in Maps.
  - If `REDIS_URL` (or host/port) is configured, it mirrors sessions into Redis and publishes changes via Redis pub/sub.
- Timeouts are scheduled **in the process**:
  - `server/src/lib/courtSessionManager.js` uses `setTimeout(...)` for phase timeouts and settlement timeouts.

## Why “horizontal scaling isn’t free” here

Horizontal scaling means “run N server instances behind a load balancer”. That introduces two core problems:

### Problem A — Socket.IO emits are local-only

If you have multiple instances:

- User A’s socket may be connected to instance 1.
- User B’s socket may be connected to instance 2.
- When instance 1 calls `emitToUser(userB, ...)`, it checks its local `userSockets` map and finds **nothing**.
- Result: **realtime updates silently don’t reach the user**.

This is why just “adding more instances” breaks realtime delivery unless you add a cross-instance routing mechanism.

### Problem B — Session timeouts and transitions can run multiple times

With multiple instances and Redis-enabled hydration:

- Each instance may hold a copy of the same session state (because the repository hydrates from Redis).
- Each instance schedules its own phase timeouts (pending/evidence/analyzing/etc).
- When timeouts fire, multiple instances can race to “toss” or “close” the same session.

Even if some DB writes are effectively idempotent, this can cause:

- Duplicated checkpoint writes / duplicated notifications
- Racy state transitions and confusing client UX
- Hard-to-debug “sometimes it double-fires” behavior at scale

## What makes the goal achievable (recommended approach)

You need two complementary fixes:

1) **Cross-instance realtime delivery** (Socket.IO scaling)
2) **Single-writer or locked state transitions** (session scaling)

### 1) Fix cross-instance realtime delivery

**Recommended: switch to “rooms per user” + Socket.IO Redis adapter.**

High-level idea:

- On `court:register`, do `socket.join(\`user:${userId}\`)`.
- Replace `emitToUser(userId, ...)` with `io.to(\`user:${userId}\`).emit(...)`.
- Configure Socket.IO with the Redis adapter so `io.to(room).emit()` works across all instances.

Why this works:

- Rooms are a Socket.IO abstraction, and the Redis adapter propagates room membership + emits across instances.
- You stop depending on a per-process `userSockets` Map for correctness.

Implementation sketch (server-side):

- Add dependency: `@socket.io/redis-adapter`
- In `server/src/lib/courtWebSocket.js`, during `new Server(...)`, attach the adapter using the existing Redis config from `server/src/lib/redis.js`.
- Modify registration to join user room(s).
- Update `emitToUser` and `isUserConnected` to use rooms (or keep `userSockets` only as a fast-path optimization, not correctness).

Operational note:

- If you run multiple instances behind a load balancer, enable **sticky sessions** anyway (helps long-polling fallback, reduces reconnect churn), but don’t rely on stickiness for correctness.

### 2) Fix duplicated state transitions/timeouts

Pick one of these patterns:

#### Option 2A (simplest): “One instance owns a session”

- Route both partners in a session to the same instance.
- Only that instance runs timeouts and performs state transitions.

This typically requires:

- A gateway layer that can consistently route by `coupleId` (or userId) to a specific backend instance
- Or a single instance per region (vertical scaling) until you outgrow it

Pros: simplest correctness model.
Cons: harder to implement on typical PaaS load balancers; less elastic.

#### Option 2B (recommended for multi-instance): “Distributed locks for transitions”

- Keep the current “shared state” approach, but ensure only one instance performs each transition/timeout action by using a Redis lock.

Pattern:

- Before running any timeout handler / phase transition, acquire a lock like:
  - `court:lock:<coupleId>:<action>` with a short TTL.
- If lock acquisition fails, skip (another instance is handling it).

Where to apply:

- All timeout handlers in `server/src/lib/courtSessionManager.js`
- Any “write” operation that changes phase or produces side effects (close, delete, create case, etc.)

You already use Redis locks in at least one place:

- `server/src/lib/court/ResolutionService.js` calls `acquireLock(...)` from `server/src/lib/redis.js`.

So the repo already has the building blocks; they just need to be applied consistently to timeouts and other transitions.

## Multi-region reality (US Supabase + US/Asia servers)

Because Supabase is hosted in the US:

- Any Asia backend instance will still talk to the US for most DB operations.
- That means Asia latency improves mainly for the “WebSocket hop”, but not for DB-heavy actions.

Pragmatic approach:

- Start with **US-only** backend for simplicity and correctness.
- Add an Asia region only when you’ve measured a real UX problem that can’t be solved otherwise.
- When you do add Asia, you must decide:
  - Are couples ever cross-region (one in US, one in Asia) during a live session?
    - If yes, you’ll want a single “home region” per session (or a global messaging layer), otherwise realtime becomes inconsistent.

## Is 2GB RAM “good”?

2GB RAM is a **much more reasonable starting point** than 512MB for Socket.IO at your target concurrency, but it’s not a guarantee.

What it depends on:

- Per-socket overhead (Engine.IO + Socket.IO) and what you store per connection
- How “chatty” your realtime events are
- How much other work the same process does (LLM calls, JSON payloads, caches, etc.)

Practical guidance:

- For **~2k concurrent connections**, 2GB is often a workable starting point if the service is otherwise light.
- For **~6k**, you may need more RAM and/or split heavy work (LLM) into a worker queue to keep the realtime node lean.

## Summary

- Today’s design assumes a single instance: socket routing (`userSockets`) and timeouts are process-local.
- Horizontal scaling breaks realtime delivery and can duplicate timeouts/transitions.
- To scale safely:
  - Use Socket.IO **rooms + Redis adapter** for cross-instance emits.
  - Add **distributed locks** (or session ownership) to prevent duplicate transitions/timeouts.

