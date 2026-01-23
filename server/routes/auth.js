const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// 1. 회원가입 (중복 체크 + 이메일 인증 발송)
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. 이미 존재하는 이메일인지 체크
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: '이미 가입된 이메일입니다.' });
    }

    const verificationToken = crypto.randomBytes(20).toString('hex');
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      email,
      password: hashedPassword,
      verificationToken,
      isVerified: false
    });

    // 2. 저장 시 발생하는 에러를 명시적으로 처리
    await user.save();

    const verifyUrl = `http://localhost:5173/verify-email/${verificationToken}`;
    await sendEmail({
      email: user.email,
      subject: '[선거 예측 지도] 이메일 인증을 완료해주세요',
      html: `<h3>환영합니다!</h3><p>아래 버튼을 눌러 인증을 완료하세요:</p><a href="${verifyUrl}" style="padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">이메일 인증하기</a>`
    });

    res.status(201).json({ message: '인증 메일이 발송되었습니다.' });
  } catch (err) {
    // MongoDB 중복 키 에러(E11000) 처리
    if (err.code === 11000) {
      return res.status(400).json({ message: '이미 가입된 이메일입니다.' });
    }
    console.error("회원가입 처리 중 치명적 에러:", err);
    res.status(500).json({ message: '서버 내부 오류가 발생했습니다.' });
  }
});

// 2. 이메일 인증 확인 (GET)
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // 1. 토큰으로 사용자 검색
    const user = await User.findOne({ verificationToken: token });

    // 2. 만약 토큰을 못 찾았다면?
    if (!user) {
      // 이미 인증이 되어서 verificationToken이 삭제되었을 수도 있으므로
      // 별도의 처리를 하거나, 여기서는 유효하지 않은 것으로 간주합니다.
      return res.status(400).json({ message: '유효하지 않은 토큰입니다.' });
    }

    // 3. 인증 성공 처리
    user.isVerified = true;
    user.verificationToken = undefined; // 토큰 즉시 삭제
    await user.save();

    res.json({ message: '인증 성공' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// 3. 로그인 (계정 잠금 로직 포함)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 이메일 인증 여부 확인
    if (!user.isVerified) {
      return res.status(401).json({ message: '이메일 인증이 완료되지 않았습니다.' });
    }

    // 계정 잠금 확인
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(403).json({ message: `비밀번호 5회 오류로 계정이 잠겼습니다. ${remainingMinutes}분 후 다시 시도하세요.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 3600000; // 1시간 잠금
      }
      await user.save();
      return res.status(400).json({ message: `비밀번호가 일치하지 않습니다. (오류 횟수: ${user.loginAttempts}/5)` });
    }

    // 로그인 성공 시 시도 횟수 초기화
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '365d' });
    res.json({ token, predictions: user.predictions });
  } catch (err) {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 4. 비밀번호 재설정 요청 (Forgot Password)
router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: '등록되지 않은 이메일입니다.' });

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1시간 유효
    await user.save();

    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;
    await sendEmail({
      email: user.email,
      subject: '[선거 예측 지도] 비밀번호 재설정 안내',
      html: `<p>비밀번호를 재설정하려면 아래 링크를 클릭하세요:</p><a href="${resetUrl}">${resetUrl}</a>`
    });

    res.json({ message: '비밀번호 재설정 메일이 발송되었습니다.' });
  } catch (err) {
    res.status(500).json({ message: '메일 발송 중 오류가 발생했습니다.' });
  }
});

// 5. 비밀번호 재설정 실행 (Reset Password)
router.post('/reset-password/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: '토큰이 만료되었거나 유효하지 않습니다.' });
    }

    user.password = await bcrypt.hash(req.body.password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.loginAttempts = 0; // 잠금 해제
    user.lockUntil = undefined;
    await user.save();

    res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
  } catch (err) {
    res.status(500).json({ message: '서버 오류로 비밀번호를 변경하지 못했습니다.' });
  }
});

module.exports = router;