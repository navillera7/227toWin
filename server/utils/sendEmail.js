const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465, // SSL 보안 포트 사용
    secure: true, // 465 포트는 반드시 true
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS.replace(/\s+/g, ''), // 혹시 모를 공백 제거
    },
    // 연결 시도 시간 제한 설정 (Render 환경 최적화)
    connectionTimeout: 10000, 
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  const mailOptions = {
    from: `"227to-win" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  // 발송 성공 여부를 명확히 로그로 확인
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("📧 이메일 발송 성공:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ nodemailer 실제 에러 상세:", error);
    throw error;
  }
};

module.exports = sendEmail;