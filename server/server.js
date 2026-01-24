const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

const allowedOrigins = [
  'https://227to-win.vercel.app', 
  'https://www.226towin.com',    // 현재 에러가 발생하는 실제 접속 주소 추가
  'https://226towin.com',        // www 없는 버전도 안전하게 추가
  'http://localhost:5173'         
];

// 2. CORS 미들웨어 설정 (오타 수정 완료)
app.use(cors({
  origin: function (origin, callback) {
    // origin이 없거나 allowedOrigins에 포함된 경우 허용
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // 보안을 위해 로그에 차단된 origin을 출력하면 디버깅이 쉽습니다.
      console.log("Blocked by CORS:", origin);
      callback(new Error('CORS 정책에 의해 차단된 도메인입니다.'));
    }
  },
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Preflight 요청(OPTIONS)을 모든 경로에서 허용
app.options('*', cors());

app.use(express.json()); // JSON 요청 본문 파싱

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB 연결 성공'))
  .catch((err) => console.error('❌ MongoDB 연결 실패:', err));

// 라우터 등록
const authRoutes = require('./routes/auth');
const predictionRoutes = require('./routes/predictions');

app.use('/api/auth', authRoutes);
app.use('/api/predict', predictionRoutes);

// 기본 경로 확인
app.get('/', (req, res) => {
  res.send('Election Predictor API Server is running...');
});

// 서버 실행
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
});