const AppError = require("../lib/AppError");
const { ErrorCode } = require("../lib/errorCodes");
const { SESSION_COOKIE, verifySessionToken, issueSessionCookie } = require("../lib/cookies");

const authRequiredError = () =>
  new AppError(ErrorCode.AUTH_REQUIRED, "Authentication required", 401);

function buildRequireAuth(authRepository) {
  return async function requireAuth(req, res, next) {
    try {
      const token = req.cookies ? req.cookies[SESSION_COOKIE] : undefined;
      if (!token) throw authRequiredError();

      let payload;
      try {
        payload = verifySessionToken(token);
      } catch {
        throw authRequiredError();
      }

      const userId = payload && payload.sub;
      if (!userId) throw authRequiredError();

      const user = await authRepository.findById(userId);
      if (!user) throw authRequiredError();

      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
      };

      // Sliding expiration: re-issue cookie with a fresh 24h lifetime on every
      // authenticated request, so active users are never kicked out mid-task.
      issueSessionCookie(res, user.id);

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = buildRequireAuth;
