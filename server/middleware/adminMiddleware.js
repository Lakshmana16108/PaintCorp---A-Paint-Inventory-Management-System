/**
 * Admin Middleware
 * Restricts access exclusively to authenticated users with role === 'Administrator'.
 * Rejects unauthorized users with HTTP 403 Forbidden.
 */
function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Access denied. Authentication required."
    });
  }

  if (req.user.role !== "Administrator") {
    return res.status(403).json({
      success: false,
      error: "Access denied. Administrator privileges required."
    });
  }

  next();
}

module.exports = adminMiddleware;
