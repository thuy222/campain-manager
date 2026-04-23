const express = require("express");
const rateLimit = require("express-rate-limit");

const validate = require("../../middleware/validate");
const buildRequireAuth = require("../../middleware/requireAuth");

const AuthRepository = require("./auth.repository");
const AuthService = require("./auth.service");
const AuthController = require("./auth.controller");
const { registerSchema } = require("./dto/register.dto");
const { loginSchema } = require("./dto/login.dto");

const repository = new AuthRepository();
const service = new AuthService(repository);
const controller = new AuthController(service);
const requireAuth = buildRequireAuth(repository);

// Slow down credential-stuffing + enumeration against unauthenticated endpoints.
// Disabled in tests so integration suites can exercise these routes freely.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many attempts, try again later.",
    },
  },
});

const router = express.Router();

router.post("/register", authLimiter, validate({ body: registerSchema }), controller.register);
router.post("/login", authLimiter, validate({ body: loginSchema }), controller.login);
router.post("/logout", controller.logout);
router.get("/me", requireAuth, controller.me);
router.post("/refresh", requireAuth, controller.refresh);

// Repository singleton is exposed so sibling modules (e.g. campaigns) can reuse
// the same instance when building their own requireAuth middleware.
module.exports = router;
module.exports.authRepository = repository;
