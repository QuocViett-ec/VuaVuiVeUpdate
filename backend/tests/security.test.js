"use strict";
const User = require("../models/User.model");
const { requireAuth } = require("../middleware/auth.middleware");
const { establishSession } = require("../services/session.service");
const { isAllowedOrigin } = require("../config/origins");
const { csrfProtection } = require("../middleware/csrf.middleware");
const { redact } = require("../services/logger");
const { hasImageSignature } = require("../middleware/upload.middleware");
const { assertTestDatabase, fixturePassword } = require("../scripts/test-data-guard");

afterEach(() => jest.restoreAllMocks());
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

test("CORS accepts only configured origins, including in development", () => {
  const previous = process.env.CLIENT_ORIGINS;
  process.env.CLIENT_ORIGINS = "https://shop.example.com,https://admin.example.com";
  try {
    expect(isAllowedOrigin("https://shop.example.com")).toBe(true);
    expect(isAllowedOrigin("https://untrusted.vercel.app")).toBe(false);
    expect(isAllowedOrigin("https://shop.example.com.attacker.example")).toBe(false);
    expect(isAllowedOrigin("http://192.168.1.10")).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(true);
    const res = response();
    csrfProtection({ method: "POST", path: "/api/auth/login", headers: { origin: "https://untrusted.vercel.app" } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  } finally {
    if (previous === undefined) delete process.env.CLIENT_ORIGINS;
    else process.env.CLIENT_ORIGINS = previous;
  }
});
test.each([
  { isActive: false, role: "user", sessionVersion: 1 },
  { isActive: true, role: "user", sessionVersion: 2 },
  { isActive: true, role: "audit", sessionVersion: 1 },
])("disabled or stale sessions are revoked", async (user) => {
  jest.spyOn(User, "findById").mockReturnValue({ select: () => ({ lean: async () => user }) });
  const session = { userId: "qa", role: "user", sessionVersion: 1, destroy: jest.fn() };
  const res = response(); const next = jest.fn();
  await requireAuth({ session }, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(session.destroy).toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});
test.each(["staff", "audit"])("valid %s admin session survives restore", async (role) => {
  jest.spyOn(User, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ role, isActive: true, sessionVersion: 0 }) }) });
  const next = jest.fn();
  await requireAuth({ sessionScope: "admin", session: { userId: "qa", role } }, response(), next);
  expect(next).toHaveBeenCalledWith();
});
test("login regenerates session before assigning identity and saving", async () => {
  const req = { session: { regenerate: (cb) => { req.session = { save: jest.fn((done) => done()) }; cb(); } } };
  await establishSession(req, { _id: "qa", role: "user", sessionVersion: 3 });
  expect(req.session).toMatchObject({ userId: "qa", role: "user", sessionVersion: 3 });
  expect(req.session.save).toHaveBeenCalled();
});
test("logs redact nested secrets and personal data", () => {
  expect(redact({ cookie: "private", data: { email: "private", password: "private" }, status: 200 }))
    .toEqual({ cookie: "[REDACTED]", data: { email: "[REDACTED]", password: "[REDACTED]" }, status: 200 });
});
test("upload does not trust declared MIME type alone", () => {
  expect(hasImageSignature(Buffer.from("<script>"), "image/jpeg")).toBe(false);
  expect(hasImageSignature(Buffer.from([255, 216, 255, 0]), "image/jpeg")).toBe(true);
});
test("demo data scripts reject production database names", () => {
  expect(() => assertTestDatabase("mongodb://localhost:27017/vuavuive")).toThrow();
});

test.each([undefined, "short"])("test accounts require an injected adequate password", (value) => {
  const previous = process.env.QA_FIXTURE_PASSWORD;
  try {
    if (value === undefined) delete process.env.QA_FIXTURE_PASSWORD;
    else process.env.QA_FIXTURE_PASSWORD = value;
    expect(() => fixturePassword()).toThrow();
  } finally {
    if (previous === undefined) delete process.env.QA_FIXTURE_PASSWORD;
    else process.env.QA_FIXTURE_PASSWORD = previous;
  }
});
