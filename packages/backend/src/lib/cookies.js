const jwt = require("jsonwebtoken");

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
  };
}

function signSessionToken(userId) {
  return jwt.sign({ sub: userId }, getJwtSecret(), {
    expiresIn: Math.floor(SESSION_MAX_AGE_MS / 1000),
  });
}

function verifySessionToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function issueSessionCookie(res, userId) {
  const token = signSessionToken(userId);
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

function clearSessionCookie(res) {
  const { maxAge: _unused, ...clearOpts } = cookieOptions();
  res.clearCookie(SESSION_COOKIE, clearOpts);
}

module.exports = {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  issueSessionCookie,
  clearSessionCookie,
  verifySessionToken,
};
