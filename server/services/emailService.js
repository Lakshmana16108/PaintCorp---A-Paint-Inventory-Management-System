const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Create transporter configuration for Gmail SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // true for port 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || "placeholder@gmail.com",
    pass: process.env.EMAIL_APP_PASSWORD || "placeholder"
  }
});

/**
 * Send Password Reset OTP Email
 * @param {string} toEmail 
 * @param {string} otp 
 * @returns {Promise<void>}
 */
async function sendOTPEmail(toEmail, otp) {
  // Always log OTP in server console for quick dev testing
  console.log(`\n==============================================`);
  console.log(`🔑 [OTP VERIFICATION CODE] Email: ${toEmail} | CODE: ${otp}`);
  console.log(`==============================================\n`);

  // Write simulated email file as a guaranteed fallback
  const simulatedPath = path.join(__dirname, "..", "simulated_email.json");
  fs.writeFileSync(simulatedPath, JSON.stringify({
    to: toEmail,
    subject: "Password Reset Verification",
    otp: otp,
    textBody: `PaintCorp ERP\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
    timestamp: new Date().toISOString()
  }, null, 2));

  // If SMTP is not configured, return early
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.warn(`[MAIL WARNING] Gmail SMTP is not configured. Code saved to server/simulated_email.json`);
    return;
  }

  const mailOptions = {
    from: `"PaintCorp ERP" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Password Reset Verification",
    text: `PaintCorp ERP\n\nPassword Reset Verification\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this password reset, please ignore this email.`,
    html: `
      <div style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; overflow: hidden;">
                <tr><td height="6" style="background-color: #2563eb;"></td></tr>
                <tr>
                  <td style="padding: 40px 32px; text-align: left;">
                    <span style="font-size: 20px; font-weight: 700; color: #1e3a8a;">PaintCorp <span style="color: #2563eb;">ERP</span></span>
                    <h1 style="margin: 20px 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a;">Password Reset Verification</h1>
                    <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
                      Use the verification code below to reset your PaintCorp ERP password:
                    </p>
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
                      <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Verification Code</div>
                      <div style="font-family: monospace; font-size: 38px; font-weight: 700; letter-spacing: 6px; color: #0f172a;">${otp}</div>
                    </div>
                    <p style="margin: 0; font-size: 13px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 24px;">
                      This verification code expires in 10 minutes. If you did not request a reset, please ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[MAIL SUCCESS] Verification OTP sent via Gmail SMTP to ${toEmail}`);
  } catch (err) {
    console.warn(`[MAIL SMTP NOTICE] Could not send via Gmail SMTP (${err.message}). Using simulated email fallback.`);
  }
}

module.exports = {
  sendOTPEmail
};

