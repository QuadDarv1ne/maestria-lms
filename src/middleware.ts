// Middleware: CSRF protection, role-based route protection, and security headers
// This file is auto-discovered by Next.js and runs on every request

export { proxy as default } from "@/proxy";
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|api/notifications/sse).*)",
  ],
};