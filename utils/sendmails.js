const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});


transporter.verify((err, success) => {
  if (err) {
    console.error(' SMTP error:', err);
  } else {
    console.log(' 👍 SMTP ready');
  }
});

const sendMail = async (to, subject, html) => {
  const info = await transporter.sendMail({
    from: `"Lead CRM" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html
  });

  console.log('📧 Mail sent:', info.messageId);
};

module.exports = sendMail;