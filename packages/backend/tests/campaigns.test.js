const request = require("supertest");

const app = require("../src/app");
const { sequelize, Recipient, CampaignRecipient } = require("../src/db/models");
const { SESSION_COOKIE } = require("../src/lib/cookies");

const USER_A = {
  email: "alice@example.com",
  name: "Alice",
  password: "password123",
};
const USER_B = {
  email: "bob@example.com",
  name: "Bob",
  password: "password123",
};

function cookieFrom(res) {
  const raw = res.headers["set-cookie"] || [];
  const line = raw.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return line ? line.split(";")[0] : null;
}

async function registerUser(user) {
  const res = await request(app).post("/api/auth/register").send(user);
  expect(res.status).toBe(201);
  return { userId: res.body.data.id, cookie: cookieFrom(res) };
}

function makeCampaignPayload(overrides = {}) {
  return {
    name: "Spring Promo",
    subject: "Big news",
    body: "Hello there!",
    recipients: ["alice@example.com", "bob@example.com"],
    ...overrides,
  };
}

beforeEach(async () => {
  await sequelize.query(
    'TRUNCATE "users","campaigns","recipients","campaign_recipients" RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await sequelize.close();
});

describe("POST /api/campaigns (create)", () => {
  test("creates a draft with normalized + deduped recipients", async () => {
    const { cookie } = await registerUser(USER_A);
    const res = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(
        makeCampaignPayload({
          recipients: ["first@example.com", " First@Example.com ", "SECOND@example.com"],
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        status: "draft",
        recipient_count: 2,
      }),
    );
  });

  test("rejects empty recipient list", async () => {
    const { cookie } = await registerUser(USER_A);
    const res = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload({ recipients: [] }));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.recipients).toMatch(/at least one/i);
  });

  test("rejects more than 100 recipients", async () => {
    const { cookie } = await registerUser(USER_A);
    const too_many = Array.from({ length: 101 }, (_, i) => `u${i}@example.com`);
    const res = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload({ recipients: too_many }));

    expect(res.status).toBe(422);
    expect(res.body.error.details.recipients).toMatch(/100/);
  });

  test("shares a recipient row across two campaigns owned by same user", async () => {
    const { cookie } = await registerUser(USER_A);
    await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload({ recipients: ["shared@example.com"] }));
    await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(
        makeCampaignPayload({
          name: "Second",
          recipients: ["shared@example.com"],
        }),
      );

    const count = await Recipient.count({
      where: { email: "shared@example.com" },
    });
    expect(count).toBe(1);
  });

  test("requires authentication", async () => {
    const res = await request(app).post("/api/campaigns").send(makeCampaignPayload());
    expect(res.status).toBe(401);
  });
});

describe("GET /api/campaigns (list)", () => {
  test("returns the caller's campaigns newest-first with pagination and filters", async () => {
    const { cookie } = await registerUser(USER_A);
    for (const name of ["one", "two", "three"]) {
      await request(app)
        .post("/api/campaigns")
        .set("Cookie", cookie)
        .send(makeCampaignPayload({ name }));
    }

    const res = await request(app).get("/api/campaigns?page=1&limit=2").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 3 });
    expect(res.body.data[0].name).toBe("three");
    expect(res.body.data[1].name).toBe("two");

    const byStatus = await request(app)
      .get("/api/campaigns?status=scheduled")
      .set("Cookie", cookie);
    expect(byStatus.status).toBe(200);
    expect(byStatus.body.data).toEqual([]);
  });

  test("empty list returns an empty array not an error", async () => {
    const { cookie } = await registerUser(USER_A);
    const res = await request(app).get("/api/campaigns").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe("GET /api/campaigns/:id", () => {
  test("returns full details with recipient_count", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());

    const res = await request(app)
      .get(`/api/campaigns/${created.body.data.id}`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: created.body.data.id,
        name: "Spring Promo",
        subject: "Big news",
        recipient_count: 2,
      }),
    );
    expect(res.body.data.recipients).toEqual(
      expect.arrayContaining(["alice@example.com", "bob@example.com"]),
    );
    expect(res.body.data.recipients).toHaveLength(2);
  });

  test("non-existent id and another user's id return identical 404", async () => {
    const a = await registerUser(USER_A);
    const b = await registerUser(USER_B);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", a.cookie)
      .send(makeCampaignPayload());

    const fake = "11111111-1111-1111-1111-111111111111";
    const missing = await request(app).get(`/api/campaigns/${fake}`).set("Cookie", b.cookie);
    const someoneElse = await request(app)
      .get(`/api/campaigns/${created.body.data.id}`)
      .set("Cookie", b.cookie);

    expect(missing.status).toBe(404);
    expect(someoneElse.status).toBe(404);
    expect(missing.body).toEqual(someoneElse.body);
    expect(missing.body.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/campaigns/:id", () => {
  test("updates name/subject/body on a draft", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());

    const res = await request(app)
      .patch(`/api/campaigns/${created.body.data.id}`)
      .set("Cookie", cookie)
      .send({ name: "Renamed" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Renamed");
  });

  test("replaces the recipient list with normalization + dedupe", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());

    const res = await request(app)
      .patch(`/api/campaigns/${created.body.data.id}`)
      .set("Cookie", cookie)
      .send({
        recipients: ["NEW@Example.com", "new@example.com", "another@example.com"],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.recipient_count).toBe(2);
  });

  test("empty body is rejected with field-level error", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());

    const res = await request(app)
      .patch(`/api/campaigns/${created.body.data.id}`)
      .set("Cookie", cookie)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("unknown fields are rejected by strict schema", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());

    const res = await request(app)
      .patch(`/api/campaigns/${created.body.data.id}`)
      .set("Cookie", cookie)
      .send({ status: "sent" });

    expect(res.status).toBe(422);
  });

  test("edit on a non-draft campaign returns 409 no-longer-editable", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());
    const id = created.body.data.id;

    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    await request(app)
      .post(`/api/campaigns/${id}/schedule`)
      .set("Cookie", cookie)
      .send({ scheduled_at: future });

    const res = await request(app)
      .patch(`/api/campaigns/${id}`)
      .set("Cookie", cookie)
      .send({ name: "too late" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STATE_CONFLICT");
    expect(res.body.error.message).toMatch(/no longer editable/);
  });
});

describe("DELETE /api/campaigns/:id", () => {
  test("deletes a draft (204) and removes its recipient links but not shared recipients", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());
    const id = created.body.data.id;

    const res = await request(app).delete(`/api/campaigns/${id}`).set("Cookie", cookie);
    expect(res.status).toBe(204);

    // Recipient row still exists (shared resource).
    const recipient = await Recipient.findOne({
      where: { email: "alice@example.com" },
    });
    expect(recipient).not.toBeNull();

    const after = await request(app).get(`/api/campaigns/${id}`).set("Cookie", cookie);
    expect(after.status).toBe(404);
  });

  test("delete on non-draft is rejected with 409", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());
    const id = created.body.data.id;

    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    await request(app)
      .post(`/api/campaigns/${id}/schedule`)
      .set("Cookie", cookie)
      .send({ scheduled_at: future });

    const res = await request(app).delete(`/api/campaigns/${id}`).set("Cookie", cookie);
    expect(res.status).toBe(409);
  });
});

describe("POST /api/campaigns/:id/schedule", () => {
  const future = () => new Date(Date.now() + 3600 * 1000).toISOString();

  test("schedules a valid draft", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());

    const res = await request(app)
      .post(`/api/campaigns/${created.body.data.id}/schedule`)
      .set("Cookie", cookie)
      .send({ scheduled_at: future() });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("scheduled");
    expect(res.body.data.scheduled_at).toBeTruthy();
  });

  test("rejects past timestamps", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());

    const past = new Date(Date.now() - 60 * 1000).toISOString();
    const res = await request(app)
      .post(`/api/campaigns/${created.body.data.id}/schedule`)
      .set("Cookie", cookie)
      .send({ scheduled_at: past });

    expect(res.status).toBe(422);
    expect(res.body.error.details.scheduled_at).toMatch(/future/i);
  });

  test("rejects scheduled_at without timezone offset", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());

    const res = await request(app)
      .post(`/api/campaigns/${created.body.data.id}/schedule`)
      .set("Cookie", cookie)
      .send({ scheduled_at: "2030-01-01T10:00:00" });

    expect(res.status).toBe(422);
    expect(res.body.error.details.scheduled_at).toMatch(/offset/i);
  });

  test("re-scheduling an already-scheduled campaign is rejected", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());
    const id = created.body.data.id;
    await request(app)
      .post(`/api/campaigns/${id}/schedule`)
      .set("Cookie", cookie)
      .send({ scheduled_at: future() });

    const res = await request(app)
      .post(`/api/campaigns/${id}/schedule`)
      .set("Cookie", cookie)
      .send({ scheduled_at: future() });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/draft/);
  });
});

describe("POST /api/campaigns/:id/send + GET /api/campaigns/:id/stats", () => {
  test("send transitions draft → sent and marks every recipient, stats reflect it", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload({ recipients: ["a@x.com", "b@x.com", "c@x.com"] }));
    const id = created.body.data.id;

    const send = await request(app).post(`/api/campaigns/${id}/send`).set("Cookie", cookie);
    expect(send.status).toBe(200);
    expect(send.body.data.status).toBe("sent");

    const stats = await request(app).get(`/api/campaigns/${id}/stats`).set("Cookie", cookie);
    expect(stats.status).toBe(200);
    expect(Object.keys(stats.body.data)).toEqual([
      "total",
      "sent",
      "failed",
      "opened",
      "open_rate",
      "send_rate",
    ]);
    expect(stats.body.data).toEqual({
      total: 3,
      sent: 3,
      failed: 0,
      opened: 0,
      open_rate: 0,
      send_rate: 1,
    });
  });

  test("send on already-sent campaign returns 409", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload());
    const id = created.body.data.id;

    await request(app).post(`/api/campaigns/${id}/send`).set("Cookie", cookie);
    const second = await request(app).post(`/api/campaigns/${id}/send`).set("Cookie", cookie);
    expect(second.status).toBe(409);
  });

  test("stats on a draft return all 6 keys with zeros", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload({ recipients: ["a@x.com"] }));

    const res = await request(app)
      .get(`/api/campaigns/${created.body.data.id}/stats`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      total: 1,
      sent: 0,
      failed: 0,
      opened: 0,
      open_rate: 0,
      send_rate: 0,
    });
  });

  test("cross-user stats look identical to a missing campaign", async () => {
    const a = await registerUser(USER_A);
    const b = await registerUser(USER_B);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", a.cookie)
      .send(makeCampaignPayload());

    const someoneElse = await request(app)
      .get(`/api/campaigns/${created.body.data.id}/stats`)
      .set("Cookie", b.cookie);
    const ghost = await request(app)
      .get(`/api/campaigns/11111111-1111-1111-1111-111111111111/stats`)
      .set("Cookie", b.cookie);

    expect(someoneElse.status).toBe(404);
    expect(ghost.status).toBe(404);
    expect(someoneElse.body).toEqual(ghost.body);
  });

  test("scheduled campaign can transition directly to sent", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload({ recipients: ["a@x.com", "b@x.com"] }));
    const id = created.body.data.id;

    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    const scheduled = await request(app)
      .post(`/api/campaigns/${id}/schedule`)
      .set("Cookie", cookie)
      .send({ scheduled_at: future });
    expect(scheduled.status).toBe(200);
    expect(scheduled.body.data.status).toBe("scheduled");

    const send = await request(app).post(`/api/campaigns/${id}/send`).set("Cookie", cookie);
    expect(send.status).toBe(200);
    expect(send.body.data.status).toBe("sent");

    const stats = await request(app).get(`/api/campaigns/${id}/stats`).set("Cookie", cookie);
    expect(stats.body.data).toEqual({
      total: 2,
      sent: 2,
      failed: 0,
      opened: 0,
      open_rate: 0,
      send_rate: 1,
    });
  });

  test("send on a campaign with zero recipients is rejected", async () => {
    const { cookie } = await registerUser(USER_A);
    const created = await request(app)
      .post("/api/campaigns")
      .set("Cookie", cookie)
      .send(makeCampaignPayload({ recipients: ["lonely@example.com"] }));
    const id = created.body.data.id;

    // DTO requires ≥1 recipient on create and update, so to reach the
    // service-level guard we wipe the join rows directly.
    await CampaignRecipient.destroy({ where: { campaign_id: id } });

    const res = await request(app).post(`/api/campaigns/${id}/send`).set("Cookie", cookie);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.recipients).toMatch(/at least one/i);

    // Guard leaves the campaign untouched — still a draft.
    const after = await request(app).get(`/api/campaigns/${id}`).set("Cookie", cookie);
    expect(after.body.data.status).toBe("draft");
  });
});
