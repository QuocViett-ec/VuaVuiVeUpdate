"use strict";

const nodemailer = require("nodemailer");
const { Resend } = require("resend");

let cachedTransporter = null;
let cachedResend = null;

function getResendClient() {
  if (cachedResend) return cachedResend;
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return null;
  cachedResend = new Resend(apiKey);
  return cachedResend;
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured");
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return cachedTransporter;
}

function buildOtpHtml({ name, otp, ttlMinutes }) {
  return [
    `<p>Xin chao ${name || "ban"},</p>`,
    "<p>Ban vua yeu cau dat lai mat khau cho tai khoan Vua Vui Ve.</p>",
    `<p><strong>Ma OTP cua ban la: ${otp}</strong></p>`,
    `<p>Ma co hieu luc trong ${ttlMinutes} phut.</p>`,
    "<p>Neu ban khong thuc hien yeu cau nay, vui long bo qua email nay.</p>",
  ].join("");
}

exports.sendPasswordResetOtpEmail = async ({ to, name, otp, ttlMinutes }) => {
  const subject = "[Vua Vui Ve] Ma OTP dat lai mat khau";
  const text = `Ma OTP dat lai mat khau cua ban la ${otp}. Ma co hieu luc ${ttlMinutes} phut.`;
  const html = buildOtpHtml({ name, otp, ttlMinutes });
  const from =
    process.env.MAIL_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.SMTP_USER ||
    "onboarding@resend.dev";

  const resendClient = getResendClient();
  if (resendClient) {
    await resendClient.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });
    return;
  }

  const transporter = getTransporter();
  await transporter.sendMail({ from, to, subject, text, html });
};
