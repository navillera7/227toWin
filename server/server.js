const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');


const allowedOrigins = [
  'https://227to-win.vercel.app', // 본인의 Vercel 주소
  'http://localhost:5173'         // 로컬 테스트용
];


// 환경 변수 로드 (.env 파일)
dotenv.config();

const app = express();

// 미들웨어 설정
app.use(cors({
  origin: function (origin, callback) {
    // origin이 없거나(로컬 툴 등) allowedOrigins에 포함된 경우 허용
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS 정책에 의해 차단된 도메인입니다.'));
    }
  },
  credentials: true, // 쿠키나 인증 헤더 허용 시 필수
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));als: true

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