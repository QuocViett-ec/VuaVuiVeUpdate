"use strict";

/**
 * CSRF protection via custom request header check.
 *
 * For state-changing requests (POST/PUT/PATCH/DELETE), we verify that
 * the request includes the custom header "X-Requested-With: XMLHttpRequest".
 * Browsers enforce the Same-Origin policy on cross-origin requests,
 * so a malicious third-party form submission cannot set this header.
 *
 * Angular HttpClient automatically adds this header via the credentials interceptor.
 */
exports.csrfProtection = (req, res, next) => {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) return next();

  // Public auth endpoints are already protected by CORS and do not require
  // an existing authenticated session, so skip the custom header check here.
  const publicAuthPaths = new Set([
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/google",
    "/api/auth/forgot-password",
  ]);
  if (publicAuthPaths.has(req.path)) return next();

  const header = req.headers["x-requested-with"];
  if (header !== "XMLHttpRequest") {
    return res.status(403).json({
      success: false,
      message: "CSRF validation failed",
    });
  }
  next();
};
