const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Ensure environment variables are loaded from all potential locations
const envPaths = [
  path.join(__dirname, "..", ".env"),
  path.join(__dirname, "..", "..", ".env"),
  path.join(process.cwd(), "server", ".env"),
  path.join(process.cwd(), ".env")
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
  }
}
require("dotenv").config();

function getStoragePath(basename) {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), basename);
  }
  return path.join(__dirname, "..", basename);
}

/**
 * Creates dynamic transporter using latest environment settings.
 */
function createTransporter() {
  const user = (process.env.EMAIL_USER || "").trim();
  const rawPass = (process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS || "").trim();
  const pass = rawPass.replace(/\s+/g, ""); // Strip any spaces from Google App Passwords

  if (!user || !pass || user.includes("placeholder") || user.includes("your_gmail_address")) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Send Password Reset OTP Email
 * @param {string} toEmail 
 * @param {string} otp 
 * @returns {Promise<{ success: boolean, delivered: boolean, error?: string }>}
 */
async function sendOTPEmail(toEmail, otp) {
  // Always log OTP in server console for development & debugging
  console.log(`\n==============================================`);
  console.log(`🔑 [OTP VERIFICATION CODE] Email: ${toEmail} | CODE: ${otp}`);
  console.log(`==============================================\n`);

  // Write simulated email file as a server-side record
  try {
    const simulatedPath = getStoragePath("simulated_email.json");
    fs.writeFileSync(simulatedPath, JSON.stringify({
      to: toEmail,
      subject: "Password Reset Verification",
      otp: otp,
      textBody: `PaintCorp ERP\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
      timestamp: new Date().toISOString()
    }, null, 2));
  } catch (err) {
    console.warn(`[MAIL NOTICE] Could not write simulated_email.json: ${err.message}`);
  }

  const transporter = createTransporter();

  // If SMTP credentials are not configured, log and return error
  if (!transporter) {
    console.warn(`[MAIL WARNING] Gmail SMTP is not configured. EMAIL_USER and EMAIL_APP_PASSWORD must be configured in environment variables.`);
    return {
      success: false,
      delivered: false,
      error: "Email delivery service is not configured. Please set EMAIL_USER and EMAIL_APP_PASSWORD in environment variables."
    };
  }

  const senderUser = process.env.EMAIL_USER;
  const mailOptions = {
    from: `"PaintCorp ERP" <${senderUser}>`,
    to: toEmail,
    subject: "PaintCorp ERP - Password Reset Verification Code",
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
    console.log(`[MAIL SUCCESS] Verification OTP successfully sent via Gmail SMTP to ${toEmail}`);
    return {
      success: true,
      delivered: true
    };
  } catch (err) {
    console.error(`[MAIL SMTP ERROR] Could not send via Gmail SMTP: ${err.message}`);
    return {
      success: false,
      delivered: false,
      error: `Could not send verification email: ${err.message}`
    };
  }
}

module.exports = {
  sendOTPEmail
};

