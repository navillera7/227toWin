// server/utils/sendEmail.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
  try {
    const data = await resend.emails.send({
      from: 'noreply@227towin.com', // 도메인 인증 전에는 이 주소를 사용해야 합니다.
      to: options.email,
      subject: options.subject,
      html: options.html,
    });

    console.log("📧 Resend를 통한 이메일 발송 성공:", data.id);
    return data;
  } catch (error) {
    console.error("❌ Resend 발송 실패:", error);
    throw error;
  }
};

module.exports = sendEmail;