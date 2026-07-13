"use strict";

const mockSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn(() => ({ emails: { send: mockSend } })),
}));

test("surfaces Resend API errors instead of reporting a false success", async () => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_FROM_EMAIL = "onboarding@resend.dev";
  process.env.MAIL_FROM = "smtp@example.com";
  mockSend.mockResolvedValue({ data: null, error: { message: "Domain is not verified" } });

  const { sendPasswordResetOtpEmail } = require("../services/mail.service");

  await expect(
    sendPasswordResetOtpEmail({
      to: "user@example.com",
      name: "Test",
      otp: "123456",
      ttlMinutes: 10,
    }),
  ).rejects.toThrow("Domain is not verified");
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({ from: "onboarding@resend.dev" }),
  );
});
