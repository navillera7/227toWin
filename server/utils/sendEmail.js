const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // 사용하는 이메일 서비스 (Gmail 권장)
    auth: {
      user: process.env.EMAIL_USER, // .env에 설정
      pass: process.env.EMAIL_PASS, // .env에 설정 (앱 비밀번호 사용)
    },
  });

  const mailOptions = {
    from: `Election Predictor <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;