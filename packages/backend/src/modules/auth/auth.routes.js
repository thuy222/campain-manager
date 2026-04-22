const express = require("express");

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

const router = express.Router();

router.post("/register", validate({ body: registerSchema }), controller.register);
router.post("/login", validate({ body: loginSchema }), controller.login);
router.post("/logout", controller.logout);
router.get("/me", requireAuth, controller.me);
router.post("/refresh", requireAuth, controller.refresh);

module.exports = router;
