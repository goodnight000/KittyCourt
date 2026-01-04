/**
 * Error Utilities
 *
 * Shared error handling utilities for consistent error responses
 * across all API routes.
 */

/**
 * Get safe error message for client response
 *
 * In production: returns generic message to avoid leaking implementation details
 * In development: returns actual error message for debugging
 *
 * @param {Error|string|any} error - Error object or message
 * @returns {string} Safe error message
 */
function safeErrorMessage(error) {
    // Check environment at runtime to allow testing with different NODE_ENV values
    const isProd = process.env.NODE_ENV === 'production';
    return isProd ? 'Internal server error' : (error?.message || String(error));
}

/**
 * Send standardized error response
 *
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} errorCode - Application error code
 * @param {string} message - Error message
 * @returns {object} Express response
 */
function sendError(res, statusCode, errorCode, message) {
    return res.status(statusCode).json({
        errorCode,
        error: message,
    });
}

module.exports = {
    safeErrorMessage,
    sendError,
};
