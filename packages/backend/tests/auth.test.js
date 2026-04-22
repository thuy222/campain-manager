const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../src/app");
const { sequelize } = require("../src/db/models");
const AuthRepository = require("../src/modules/auth/auth.repository");
const { SESSION_COOKIE } = require("../src/lib/cookies");

const authRepository = new AuthRepository();

const VALID = {
  email: "alice@example.com",
  name: "Alice",
  password: "password123",
};

function sessionCookieFrom(res) {
  const raw = res.headers["set-cookie"] || [];
  const line = raw.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!line) return null;
  return line.split(";")[0]; // "session=<jwt>"
}

beforeEach(async () => {
  await sequelize.query('TRUNCATE "users" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await sequelize.close();
});

describe("POST /api/auth/register", () => {
  test("(1) registers a new user and signs them in immediately", async () => {
    const res = await request(app).post("/api/auth/register").send(VALID);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      data: expect.objectContaining({
        id: expect.any(String),
        email: VALID.email,
        name: VALID.name,
        created_at: expect.any(String),
      }),
    });
    const cookie = sessionCookieFrom(res);
    expect(cookie).toBeTruthy();

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(VALID.email);
  });

  test("(2) rejects duplicate email (case-insensitive)", async () => {
    await request(app).post("/api/auth/register").send(VALID);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...VALID, email: "Alice@Example.com" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("rejects password shorter than 8 characters with field-level detail", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...VALID, password: "short" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.password).toMatch(/8/);
  });

  test("rejects malformed email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...VALID, email: "not-an-email" });

    expect(res.status).toBe(422);
    expect(res.body.error.details.email).toBeTruthy();
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send(VALID);
  });

  test("(3) signs in with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID.email, password: VALID.password });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(VALID.email);
    expect(sessionCookieFrom(res)).toBeTruthy();
  });

  test("(4) wrong password and unknown email produce the same generic failure", async () => {
    const wrongPw = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID.email, password: "wrong-password" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: VALID.password });

    for (const res of [wrongPw, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: "AUTH_REQUIRED", message: "Invalid email or password" },
      });
    }
    expect(wrongPw.body).toEqual(unknownEmail.body);
  });

  test("normalizes email case and whitespace before matching", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "  Alice@Example.com  ", password: VALID.password });

    expect(res.status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  let cookie;

  beforeEach(async () => {
    const res = await request(app).post("/api/auth/register").send(VALID);
    cookie = sessionCookieFrom(res);
  });

  test("(5) returns account info without password", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(res.status).toBe(200);
    const user = res.body.data;
    expect(user).toEqual({
      id: expect.any(String),
      email: VALID.email,
      name: VALID.name,
      created_at: expect.any(String),
    });
    expect(user).not.toHaveProperty("password");
    expect(user).not.toHaveProperty("password_hash");
  });

  test("(9) if the user record is deleted, next request is rejected", async () => {
    const existing = await authRepository.findByEmail(VALID.email);
    await authRepository.deleteById(existing.id);
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
  });
});

describe("POST /api/auth/refresh", () => {
  test("(6) extends a fresh session and re-issues the cookie", async () => {
    const reg = await request(app).post("/api/auth/register").send(VALID);
    const cookie = sessionCookieFrom(reg);

    const res = await request(app).post("/api/auth/refresh").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(VALID.email);
    expect(sessionCookieFrom(res)).toBeTruthy();
  });

  test("(7) rejects expired session", async () => {
    const reg = await request(app).post("/api/auth/register").send(VALID);
    const userId = reg.body.data.id;
    const expired = jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
      expiresIn: "-1h",
    });

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `${SESSION_COOKIE}=${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
  });
});

describe("POST /api/auth/logout", () => {
  test("(8) ends the session; subsequent protected actions are rejected", async () => {
    const reg = await request(app).post("/api/auth/register").send(VALID);
    const cookie = sessionCookieFrom(reg);

    const out = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(out.status).toBe(204);

    // Simulate the browser honoring the clear-cookie directive: no cookie sent.
    const me = await request(app).get("/api/auth/me");
    expect(me.status).toBe(401);
  });
});

describe("Never-leak guarantees", () => {
  test("(10) password never appears in any response (success or error)", async () => {
    const reg = await request(app).post("/api/auth/register").send(VALID);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID.email, password: VALID.password });
    const badLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID.email, password: "wrong-password" });
    const me = await request(app).get("/api/auth/me").set("Cookie", sessionCookieFrom(reg));

    for (const res of [reg, login, badLogin, me]) {
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/password_hash/i);
      expect(body).not.toMatch(/"password"/i);
    }
  });

  test("(11) missing / tampered / truncated / expired cookies all return the identical 401", async () => {
    const reg = await request(app).post("/api/auth/register").send(VALID);
    const userId = reg.body.data.id;
    const expired = jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
      expiresIn: "-1h",
    });
    const good = sessionCookieFrom(reg).split("=")[1];

    const cases = [
      undefined, // missing
      `${SESSION_COOKIE}=not-a-jwt`, // tampered / bogus
      `${SESSION_COOKIE}=${good.slice(0, 20)}`, // truncated
      `${SESSION_COOKIE}=${expired}`, // expired
      `${SESSION_COOKIE}=${jwt.sign({ sub: userId }, "wrong-secret", { expiresIn: "1h" })}`, // wrong signature
    ];

    const bodies = [];
    for (const cookie of cases) {
      const req = request(app).get("/api/auth/me");
      if (cookie) req.set("Cookie", cookie);
      const res = await req;
      expect(res.status).toBe(401);
      bodies.push(JSON.stringify(res.body));
    }

    // All 401 bodies must be byte-identical per acceptance criterion 11.
    for (const body of bodies) {
      expect(body).toBe(bodies[0]);
    }
    expect(JSON.parse(bodies[0])).toEqual({
      error: { code: "AUTH_REQUIRED", message: "Authentication required" },
    });
  });
});
