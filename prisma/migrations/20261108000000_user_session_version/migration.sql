-- Migration: user_session_version
--
-- Sessions are stateless JWTs valid for 30 days, so a password reset (or a 2FA
-- change) used to leave every previously issued token working: an attacker who
-- had stolen a cookie kept access even after the victim "recovered" the account.
--
-- `sessionVersion` is the epoch of the credentials. It is embedded into the JWT
-- at issue time and compared in the jwt callback; bumping it on any credential
-- change invalidates all outstanding tokens for that user at once.
--
-- Existing rows start at 0, and tokens issued before this migration carry no
-- version — those are treated as stale, so everyone signs in once after deploy.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
