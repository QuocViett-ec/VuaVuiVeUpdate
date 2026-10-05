"use strict";

function assertTestDatabase(uri = process.env.MONGO_URI) {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(uri || "");
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_TEST_DATA !== "true" ||
      !match || !/(?:_test|_staging)$/.test(match[1])) {
    throw new Error("Test-data scripts require ALLOW_TEST_DATA=true, a *_test/*_staging database, and a non-production NODE_ENV.");
  }
}

function fixturePassword() {
  const password = process.env.QA_FIXTURE_PASSWORD;
  if (typeof password !== "string" || password.length < 12) throw new Error("Inject QA_FIXTURE_PASSWORD (at least 12 characters) before creating test accounts.");
  return password;
}
module.exports = { assertTestDatabase, fixturePassword };
