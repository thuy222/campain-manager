const asyncHandler = require("../../lib/asyncHandler");
const { issueSessionCookie, clearSessionCookie } = require("../../lib/cookies");

class AuthController {
  constructor(service) {
    this.service = service;
  }

  register = asyncHandler(async (req, res) => {
    const user = await this.service.register(req.body);
    issueSessionCookie(res, user.id);
    res.status(201).json({ data: user });
  });

  login = asyncHandler(async (req, res) => {
    const user = await this.service.login(req.body);
    issueSessionCookie(res, user.id);
    res.status(200).json({ data: user });
  });

  logout = asyncHandler(async (req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  me = asyncHandler(async (req, res) => {
    res.status(200).json({ data: req.user });
  });

  refresh = asyncHandler(async (req, res) => {
    // requireAuth already re-issued the cookie with a fresh 24h expiry.
    res.status(200).json({ data: req.user });
  });
}

module.exports = AuthController;
