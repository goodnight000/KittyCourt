/**
 * CommonJS wrapper for requirePartner ES module
 *
 * This wrapper enables CommonJS routes to import the ES module middleware.
 * The actual implementation is in requirePartner.js (ES module).
 */

let _requirePartner;

async function loadMiddleware() {
  if (!_requirePartner) {
    const module = await import('./requirePartner.js');
    _requirePartner = module.requirePartner;
  }
  return _requirePartner;
}

// Export a wrapper function that loads the ES module async
function requirePartner(req, res, next) {
  loadMiddleware()
    .then(middleware => middleware(req, res, next))
    .catch(error => {
      console.error('[requirePartner] Failed to load middleware:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
}

module.exports = { requirePartner };
