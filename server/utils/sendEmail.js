const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Gmail 전용 설정을 사용하면 host/port 설정을 알아서 최적화합니다.
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // 연결 타임아웃 시간을 늘려줍니다.
    connectionTimeout: 10000, // 10초
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  const mailOptions = {
    from: `"선거 예측 지도" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ 이메일 발송 성공:", options.email);
  } catch (error) {
    console.error("❌ 이메일 발송 실패 상세 에러:", error);
    throw error; // 에러를 다시 던져서 상위 라우트에서 처리하게 함
  }
};

module.exports = sendEmail;