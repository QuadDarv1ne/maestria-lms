/**
 * Custom production server for Maestria LMS
 *
 * Wraps Next.js to inject CSP nonces into HTML responses.
 *
 * PROBLEM: Amvera's nginx reverse proxy injects a restrictive CSP header:
 *   Content-Security-Policy: script-src 'self' 'sha256-...'
 * This blocks all Next.js inline bootstrap scripts.
 *
 * SOLUTION: This server:
 * 1. Creates a NextServer instance
 * 2. Wraps the request handler to intercept HTML responses
 * 3. Adds nonce attributes to all <script> tags
 * 4. Strips Amvera's CSP header and injects <meta> CSP tag with nonce
 *
 * USAGE: node server-with-csp.js
 *   PORT     - Port to listen on (default: 3000)
 *   HOSTNAME - Bind address (default: "0.0.0.0")
 */

const http = require("http");
const { randomBytes } = require("crypto");

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOSTNAME = process.env.HOSTNAME || "0.0.0.0";

function generateNonce() {
  return randomBytes(16).toString("base64url");
}

function isHtmlResponse(contentType) {
  return contentType && contentType.includes("text/html");
}

/**
 * Transform HTML to inject nonces and CSP meta tag.
 * Strips any existing CSP meta tags first, then adds our own.
 */
function transformHtml(html, nonce) {
  // Remove any existing CSP meta tags to avoid conflicts
  html = html.replace(
    /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
    ""
  );

  // Add nonce to all <script> tags that don't already have one
  html = html.replace(
    /<script\b(?![^>]*\bnonce\s*=)/gi,
    (match) => `<script nonce="${nonce}"`
  );

  // Add nonce to all <style> tags that don't already have one
  html = html.replace(
    /<style\b(?![^>]*\bnonce\s*=)/gi,
    (match) => `<style nonce="${nonce}"`
  );

  // Inject CSP <meta> tag right after <head>
  // This CSP allows everything needed for Next.js to function
  const cspMeta = [
    `<meta`,
    ` http-equiv="Content-Security-Policy"`,
    ` content="`,
    `default-src 'self';`,
    ` script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval';`,
    ` style-src 'self' 'unsafe-inline';`,
    ` img-src 'self' data: blob: https:;`,
    ` font-src 'self' data:;`,
    ` connect-src 'self' https: wss:;`,
    ` frame-src 'self' https:;`,
    ` object-src 'none';`,
    ` base-uri 'self';`,
    ` form-action 'self';`,
    `"`,
    ` />`,
  ].join("");

  html = html.replace("<head>", `<head>${cspMeta}`);

  return html;
}

async function startServer() {
  console.log("[server-with-csp] Starting Maestria LMS with CSP nonce injection...");

  // Load the Next.js server module
  // In standalone mode, server.js is a self-contained HTTP server
  // We need to intercept its HTTP server creation
  const next = require("next");

  // Create Next.js app in production mode
  const app = next({
    dev: false,
    hostname: HOSTNAME,
    port: PORT,
    dir: process.cwd(),
    customServer: true,
  });

  // Get the request handler
  const handle = app.getRequestHandler();

  // Prepare the app (loads config, builds the request handler)
  await app.prepare();

  // Create HTTP server
  const server = http.createServer(async (req, res) => {
    const startTime = Date.now();
    const nonce = generateNonce();

    try {
      // Store nonce for the request so Next.js can use it
      req.nonce = nonce;

      // Intercept res.writeHead and res.end to modify HTML responses
      const originalWriteHead = res.writeHead.bind(res);
      const originalEnd = res.end.bind(res);
      const originalWrite = res.write.bind(res);

      let bodyChunks = [];
      let headers = {};
      let statusCode = 200;
      let headersSent = false;

      // Override writeHead to capture headers
      res.writeHead = function (status, statusHeaders, ...args) {
        if (typeof status === "number") {
          statusCode = status;
          if (statusHeaders) {
            headers = { ...headers, ...statusHeaders };
          }
        } else if (typeof status === "object") {
          headers = { ...headers, ...status };
        }
        // Don't call original yet - wait until end
        return res;
      };

      // Override setHeader to capture headers
      const originalSetHeader = res.setHeader.bind(res);
      res.setHeader = function (key, value) {
        headers[key] = value;
        return res;
      };

      // Override write to capture body chunks
      res.write = function (chunk) {
        if (chunk) {
          bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return true;
      };

      // Override end to process the response
      res.end = function (chunk) {
        if (chunk) {
          bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        const contentType = headers["content-type"] || headers["Content-Type"] || "";
        const body = Buffer.concat(bodyChunks);

        if (isHtmlResponse(contentType)) {
          // Transform HTML: inject nonces and CSP meta tag
          const html = body.toString("utf-8");
          const transformedHtml = transformHtml(html, nonce);

          // Strip CSP header (Amvera's proxy injects it, we replace with meta tag)
          delete headers["content-security-policy"];
          delete headers["Content-Security-Policy"];
          delete headers["content-security-policy-report-only"];
          delete headers["Content-Security-Policy-Report-Only"];

          // Update content-length
          const newBody = Buffer.from(transformedHtml, "utf-8");
          headers["content-length"] = String(newBody.length);

          // Send the modified response
          originalWriteHead(statusCode, headers);
          originalEnd(newBody);
        } else {
          // Pass through non-HTML responses unchanged
          originalWriteHead(statusCode, headers);
          if (body.length > 0) {
            originalEnd(body);
          } else {
            originalEnd();
          }
        }

        const duration = Date.now() - startTime;
        console.log(`[server-with-csp] ${req.method} ${req.url} → ${statusCode} (${duration}ms)`);
      };

      // Let Next.js handle the request
      await handle(req, res);
    } catch (err) {
      console.error(`[server-with-csp] Error handling ${req.method} ${req.url}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Bad Gateway");
      }
    }
  });

  server.listen(PORT, HOSTNAME, () => {
    console.log(`[server-with-csp] Server listening on http://${HOSTNAME}:${PORT}`);
    console.log(`[server-with-csp] CSP nonce injection enabled`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("[server-with-csp] Shutting down...");
    server.close(() => {
      console.log("[server-with-csp] Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch((err) => {
  console.error("[server-with-csp] Failed to start:", err);
  process.exit(1);
});