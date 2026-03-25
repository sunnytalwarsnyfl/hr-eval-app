const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

async function sendEmail({ to, subject, html }) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
    return { mocked: true };
  }
  return transporter.sendMail({
    from: `"SIPS HR System" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  });
}

module.exports = { sendEmail };
