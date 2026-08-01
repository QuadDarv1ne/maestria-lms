/**
 * Custom production server for Maestria LMS
 *
 * Wraps the Next.js standalone server to inject CSP nonces into HTML responses.
 *
 * PROBLEM: Amvera's nginx reverse proxy injects a restrictive CSP header:
 *   Content-Security-Policy: script-src 'self' 'sha256-...'
 * This blocks all Next.js inline bootstrap scripts (which have different
 * hashes on every build), causing the entire site to render blank.
 *
 * SOLUTION: This server:
 * 1. Spawns the Next.js standalone server (server.js) as a child process
 *    on an internal port
 * 2. Acts as a reverse proxy using Node.js built-in http module
 * 3. Intercepts HTML responses to add nonce attributes to <script> tags
 * 4. Strips Amvera's CSP header and injects <meta> CSP tag with nonce
 *
 * USAGE: node server-with-csp.js
 *   PORT     - Port to listen on (default: 3000)
 *   HOSTNAME - Bind address (default: "0.0.0.0")
 */

const http = require("http");
const { randomBytes } = require("crypto");
const { spawn } = require("child_process");
const path = require("path");

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
const INTERNAL_PORT = PORT + 1;

function generateNonce() {
  return randomBytes(16).toString("base64url");
}

function isHtmlResponse(contentType) {
  return contentType && contentType.includes("text/html");
}

/**
 * Transform HTML to inject nonces and CSP meta tag.
 */
function transformHtml(html, nonce) {
  // Remove any existing CSP meta tags
  html = html.replace(
    /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
    ""
  );

  // Add nonce to all <script> tags without one
  html = html.replace(
    /<script\b(?![^>]*\bnonce\s*=)/gi,
    (_match) => `<script nonce="${nonce}"`
  );

  // Add nonce to all <style> tags without one
  html = html.replace(
    /<style\b(?![^>]*\bnonce\s*=)/gi,
    (_match) => `<style nonce="${nonce}"`
  );

  // Inject CSP <meta> tag right after <head>
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

/**
 * Forward a request to the internal Next.js server and return the response.
 * Uses only Node.js built-in modules (no external dependencies).
 */
function forwardRequest(req, res, nonce) {
  const startTime = Date.now();
  const options = {
    hostname: "127.0.0.1",
    port: INTERNAL_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers },
  };

  // Remove host header to avoid conflicts
  delete options.headers.host;

  const proxyReq = http.request(options, (proxyRes) => {
    const chunks = [];

    proxyRes.on("data", (chunk) => {
      chunks.push(chunk);
    });

    proxyRes.on("end", () => {
      const body = Buffer.concat(chunks);
      const contentType = proxyRes.headers["content-type"] || "";

      // Copy headers, stripping CSP
      const responseHeaders = { ...proxyRes.headers };
      delete responseHeaders["content-security-policy"];
      delete responseHeaders["content-security-policy-report-only"];

      if (isHtmlResponse(contentType)) {
        const html = body.toString("utf-8");
        const transformedHtml = transformHtml(html, nonce);
        const newBody = Buffer.from(transformedHtml, "utf-8");
        responseHeaders["content-length"] = String(newBody.length);

        res.writeHead(proxyRes.statusCode, responseHeaders);
        res.end(newBody);
      } else {
        res.writeHead(proxyRes.statusCode, responseHeaders);
        res.end(body);
      }

      const duration = Date.now() - startTime;
      console.log(`[server-with-csp] ${req.method} ${req.url} → ${proxyRes.statusCode} (${duration}ms)`);
    });
  });

  proxyReq.on("error", (err) => {
    console.error(`[server-with-csp] Proxy error for ${req.method} ${req.url}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Bad Gateway");
    }
  });

  // Forward the request body
  if (req.body || req.method !== "GET") {
    const bodyChunks = [];
    req.on("data", (chunk) => bodyChunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(bodyChunks);
      proxyReq.end(body);
    });
  } else {
    proxyReq.end();
  }
}

async function startServer() {
  console.log("[server-with-csp] Starting Maestria LMS with CSP nonce injection...");

  // Start the Next.js standalone server on an internal port
  const serverJsPath = path.join(__dirname, "server.js");
  console.log(`[server-with-csp] Spawning Next.js server: node ${serverJsPath} on port ${INTERNAL_PORT}`);

  const nextServer = spawn("node", [serverJsPath], {
    env: {
      ...process.env,
      PORT: String(INTERNAL_PORT),
      HOSTNAME: "127.0.0.1",
    },
    stdio: ["pipe", "inherit", "inherit"],
  });

  nextServer.on("error", (err) => {
    console.error("[server-with-csp] Failed to spawn Next.js server:", err.message);
    process.exit(1);
  });

  // Wait for the Next.js server to start
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Create the proxy server
  const server = http.createServer((req, res) => {
    const nonce = generateNonce();
    forwardRequest(req, res, nonce);
  });

  server.listen(PORT, HOSTNAME, () => {
    console.log(`[server-with-csp] Proxy listening on http://${HOSTNAME}:${PORT}`);
    console.log(`[server-with-csp] Forwarding to internal Next.js on http://127.0.0.1:${INTERNAL_PORT}`);
    console.log(`[server-with-csp] CSP nonce injection enabled`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("[server-with-csp] Shutting down...");
    nextServer.kill("SIGTERM");
    server.close(() => process.exit(0));
    // Force exit after 5s
    setTimeout(() => process.exit(1), 5000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  nextServer.on("exit", (code) => {
    console.error(`[server-with-csp] Next.js server exited with code ${code}`);
    process.exit(code);
  });
}

startServer().catch((err) => {
  console.error("[server-with-csp] Failed to start:", err);
  process.exit(1);
});