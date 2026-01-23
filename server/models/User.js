const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  
  // 이메일 인증 관련
  isVerified: { type: Boolean, default: false },
  verificationToken: String,

  // 계정 잠금 관련
  loginAttempts: { type: Number, required: true, default: 0 },
  lockUntil: { type: Number },

  // 비밀번호 재설정 관련
  resetPasswordToken: String,
  resetPasswordExpires: Date,

  predictions: {
    metro: { type: Map, of: String, default: {} },
    local: { type: Map, of: String, default: {} }
  }
});

// 계정 잠금 여부 확인 가상 속성
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

module.exports = mongoose.model('User', userSchema);