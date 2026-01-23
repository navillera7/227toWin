const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // 헤더에서 토큰 추출
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" 형식

  // 토큰이 없는 경우
  if (!token) {
    return res.status(401).json({ message: '인증 토큰이 없습니다. 로그인이 필요합니다.' });
  }

  try {
    // 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 요청 객체에 유저 ID 주입 (이후 라우터에서 사용 가능)
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ message: '토큰이 유효하지 않습니다.' });
  }
};