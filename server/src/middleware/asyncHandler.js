/**
 * Async Handler Middleware
 *
 * Wraps async route handlers to catch promise rejections and pass them to Express error handlers.
 * Eliminates the need for try-catch blocks or IIFE patterns in async routes.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => {
 *     const data = await someAsyncOperation();
 *     res.json(data);
 *   }));
 */

/**
 * Wraps an async route handler to catch rejected promises
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express route handler that catches errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  try {
    return Promise.resolve(fn(req, res, next)).catch(next);
  } catch (error) {
    return next(error);
  }
};

module.exports = { asyncHandler };
