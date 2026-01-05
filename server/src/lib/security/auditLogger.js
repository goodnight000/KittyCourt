/**
 * Security Audit Logging System
 *
 * Provides structured logging for security events with support for
 * file-based logging and alerting on critical events.
 */

const fs = require('fs');
const path = require('path');
const { securityConfig } = require('./config/securityConfig');

const LOG_DIR = process.env.SECURITY_LOG_DIR || path.join(process.cwd(), 'logs', 'security');
const ALERT_WEBHOOK = process.env.SECURITY_ALERT_WEBHOOK;

// Ensure log directory exists
function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (error) {
    console.error('[AuditLogger] Failed to create log directory:', error.message);
  }
}

// Initialize on module load
ensureLogDir();

/**
 * Get current log file path (daily rotation)
 */
function getLogFilePath() {
  const date = new Date().toISOString().split('T')[0];
  return path.join(LOG_DIR, `security-${date}.log`);
}

/**
 * Format log entry as JSON line
 * @param {Object} event - Security event
 * @returns {string} - Formatted log entry
 */
function formatLogEntry(event) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event,
  });
}

/**
 * Send alert for critical events (non-blocking)
 * @param {Object} event - Security event
 */
async function sendAlert(event) {
  if (!ALERT_WEBHOOK) return;

  try {
    const response = await fetch(ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[SECURITY ALERT] ${event.type}`,
        severity: event.severity,
        details: event,
        timestamp: new Date().toISOString(),
        service: 'pause-api',
      }),
    });

    if (!response.ok) {
      console.error('[AuditLogger] Alert webhook returned non-OK status:', response.status);
    }
  } catch (error) {
    console.error('[AuditLogger] Failed to send security alert:', error.message);
  }
}

/**
 * Log a security event
 * @param {Object} event - Security event to log
 */
async function logSecurityEvent(event) {
  const { severity = 'INFO' } = event;

  // Enrich event with metadata
  const enrichedEvent = {
    ...event,
    environment: process.env.NODE_ENV || 'development',
    service: 'pause-api',
    version: process.env.npm_package_version || 'unknown',
  };

  // Format log entry
  const logEntry = formatLogEntry(enrichedEvent);

  // Console output (development or when enabled)
  if (securityConfig.auditConfig.enableConsole) {
    const colors = {
      DEBUG: '\x1b[36m',   // Cyan
      INFO: '\x1b[32m',    // Green
      WARN: '\x1b[33m',    // Yellow
      ERROR: '\x1b[31m',   // Red
      CRITICAL: '\x1b[35m', // Magenta
    };
    const reset = '\x1b[0m';
    const color = colors[severity] || '';
    console.log(`${color}[SECURITY ${severity}]${reset}`, JSON.stringify(enrichedEvent, null, 2));
  }

  // Write to file (async, non-blocking)
  try {
    const logFile = getLogFilePath();
    fs.appendFile(logFile, logEntry + '\n', (err) => {
      if (err) {
        console.error('[AuditLogger] Failed to write log:', err.message);
      }
    });
  } catch (error) {
    console.error('[AuditLogger] Failed to write security log:', error.message);
  }

  // Send alert for high-severity events (async, non-blocking)
  if (securityConfig.auditConfig.alertOnSeverity.includes(severity)) {
    sendAlert(enrichedEvent).catch(() => {});
  }
}

/**
 * Audit logger with convenience methods
 */
const auditLogger = {
  logSecurityEvent,

  // Severity-based convenience methods
  debug: (event) => logSecurityEvent({ ...event, severity: 'DEBUG' }),
  info: (event) => logSecurityEvent({ ...event, severity: 'INFO' }),
  warn: (event) => logSecurityEvent({ ...event, severity: 'WARN' }),
  error: (event) => logSecurityEvent({ ...event, severity: 'ERROR' }),
  critical: (event) => logSecurityEvent({ ...event, severity: 'CRITICAL' }),

  // Event-type specific loggers
  logInjectionAttempt: (userId, details) => logSecurityEvent({
    type: 'INJECTION_ATTEMPT',
    severity: details.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
    userId,
    ...details,
  }),

  logRateLimitExceeded: (userId, endpoint, details = {}) => logSecurityEvent({
    type: 'RATE_LIMIT_EXCEEDED',
    severity: 'WARN',
    userId,
    endpoint,
    ...details,
  }),

  logBlockedRequest: (userId, reason, details = {}) => logSecurityEvent({
    type: 'REQUEST_BLOCKED',
    severity: 'HIGH',
    userId,
    reason,
    ...details,
  }),

  logOutputAnomaly: (userId, details) => logSecurityEvent({
    type: 'OUTPUT_ANOMALY',
    severity: 'HIGH',
    userId,
    ...details,
  }),

  logInputSanitized: (userId, fieldName, modifications) => logSecurityEvent({
    type: 'INPUT_SANITIZED',
    severity: 'INFO',
    userId,
    fieldName,
    modifications,
  }),

  logUserBlocked: (userId, reason, durationMs) => logSecurityEvent({
    type: 'USER_BLOCKED',
    severity: 'CRITICAL',
    userId,
    reason,
    durationMs,
    expiresAt: new Date(Date.now() + durationMs).toISOString(),
  }),

  logAbusePattern: (userId, details) => logSecurityEvent({
    type: 'ABUSE_PATTERN_DETECTED',
    severity: 'HIGH',
    userId,
    ...details,
  }),

  logLLMCall: (userId, endpoint, details = {}) => logSecurityEvent({
    type: 'LLM_CALL',
    severity: 'DEBUG',
    userId,
    endpoint,
    ...details,
  }),

  logOutputCompromise: (userId, endpoint, details) => logSecurityEvent({
    type: 'OUTPUT_COMPROMISE_DETECTED',
    severity: 'CRITICAL',
    userId,
    endpoint,
    ...details,
  }),
};

/**
 * Query security logs (for admin dashboard)
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} - Matching log entries
 */
async function querySecurityLogs(filters = {}) {
  const { startDate, endDate, severity, type, userId, limit = 100 } = filters;

  const results = [];

  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('security-') && f.endsWith('.log'))
      .sort()
      .slice(-7); // Last 7 days

    for (const file of files) {
      const content = fs.readFileSync(path.join(LOG_DIR, file), 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // Apply filters
          if (startDate && new Date(entry.timestamp) < new Date(startDate)) continue;
          if (endDate && new Date(entry.timestamp) > new Date(endDate)) continue;
          if (severity && entry.severity !== severity) continue;
          if (type && entry.type !== type) continue;
          if (userId && entry.userId !== userId) continue;

          results.push(entry);

          if (results.length >= limit) break;
        } catch (e) {
          // Skip malformed log lines
        }
      }

      if (results.length >= limit) break;
    }
  } catch (error) {
    console.error('[AuditLogger] Failed to query logs:', error.message);
  }

  return results;
}

/**
 * Get security metrics summary
 * @param {number} hoursBack - Hours to look back
 * @returns {Promise<Object>} - Metrics summary
 */
async function getSecurityMetrics(hoursBack = 24) {
  const startDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const logs = await querySecurityLogs({ startDate, limit: 10000 });

  const metrics = {
    totalEvents: logs.length,
    bySeverity: {},
    byType: {},
    blockedRequests: 0,
    injectionAttempts: 0,
    uniqueUsers: new Set(),
    timeRange: {
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  };

  for (const log of logs) {
    // Count by severity
    metrics.bySeverity[log.severity] = (metrics.bySeverity[log.severity] || 0) + 1;

    // Count by type
    metrics.byType[log.type] = (metrics.byType[log.type] || 0) + 1;

    // Specific counts
    if (log.type === 'REQUEST_BLOCKED') metrics.blockedRequests++;
    if (log.type === 'INJECTION_ATTEMPT') metrics.injectionAttempts++;

    // Track unique users
    if (log.userId) metrics.uniqueUsers.add(log.userId);
  }

  metrics.uniqueUsersCount = metrics.uniqueUsers.size;
  delete metrics.uniqueUsers;

  return metrics;
}

module.exports = {
  auditLogger,
  logSecurityEvent,
  querySecurityLogs,
  getSecurityMetrics,
};
