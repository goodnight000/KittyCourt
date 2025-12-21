/**
 * Court Service Initialization - Clean Architecture
 * 
 * Wires together all court session services.
 * Call this once during server startup.
 */

const { courtSessionManager } = require('./courtSessionManager');
const courtWebSocket = require('./courtWebSocket');
const courtDatabase = require('./courtDatabase');
const {
    deliberate,
    deliberatePhase1,
    deliberatePhase2,
    runHybridResolution
} = require('./judgeEngine');
const { triggerBackgroundExtraction } = require('./stenographer');

/**
 * Initialize court session services
 * @param {object} httpServer - HTTP server for WebSocket
 */
async function initializeCourtServices(httpServer) {
    console.log('[Court] Initializing court services...');

    // 1. Connect database service to session manager
    courtSessionManager.setDatabaseService(courtDatabase);

    // 2. Connect judge engine to session manager (v2.0 pipeline + legacy)
    courtSessionManager.setJudgeEngine({
        // V2.0 pipeline functions
        deliberatePhase1,
        deliberatePhase2,
        runHybridResolution,
        // Legacy function (backward compat)
        deliberate,
        // Background processing
        triggerBackgroundExtraction
    });

    // 3. Initialize WebSocket (also connects to session manager)
    courtWebSocket.initialize(httpServer);

    // 4. Recover active sessions from database
    const activeSessions = await courtDatabase.getActiveSessions();
    if (activeSessions.length > 0) {
        await courtSessionManager.recoverFromDatabase(activeSessions);
        console.log(`[Court] Recovered ${activeSessions.length} sessions from database`);
    }

    // 5. Clean up old sessions
    await courtDatabase.cleanupOldSessions();

    console.log('[Court] Court services initialized');
}

module.exports = { initializeCourtServices };
