/**
 * Development Proxy Configuration for Security Headers
 *
 * This file configures security headers for the React development server.
 * In production, these headers should be configured at the web server level
 * (nginx, Apache, or CDN like Cloudflare).
 *
 * See: https://create-react-app.dev/docs/proxying-api-requests-in-development/
 */

module.exports = function(app) {
  // Add security headers middleware
  app.use((req, res, next) => {
    // Content Security Policy
    // Restricts sources for scripts, styles, images, etc.
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // React dev requires unsafe-inline and unsafe-eval
        "style-src 'self' 'unsafe-inline'", // Material-UI requires unsafe-inline
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' http://localhost:5001 ws://localhost:3000", // WebSocket for hot reload
        "frame-ancestors 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'"
      ].join('; ')
    );

    // Prevent clickjacking attacks
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Referrer Policy - Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy - Disable unused browser features
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
    );

    // Cross-Origin Policies for Spectre protection
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

    // Remove X-Powered-By header (information disclosure)
    res.removeHeader('X-Powered-By');

    // Note: Strict-Transport-Security (HSTS) is intentionally NOT set in development
    // HSTS should ONLY be enabled in production with HTTPS
    // Enabling it in development (HTTP) can cause browser issues

    next();
  });
};
