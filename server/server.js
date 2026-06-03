const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://227towin.com'         
];

// CORS 미들웨어 설정
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      callback(new Error('CORS 정책에 의해 차단된 도메인입니다.'));
    }
  },
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Preflight 요청(OPTIONS)을 모든 경로에서 허용
app.options(/.*/, cors());

app.use(express.json()); // JSON 요청 본문 파싱

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB 연결 성공'))
  .catch((err) => console.error('❌ MongoDB 연결 실패:', err));

// 라우터 등록
const authRoutes = require('./routes/auth');
const predictionRoutes = require('./routes/predictions');
const scrapeRouter = require('./scrape'); // 정상적으로 scrapeRouter 선언

app.use('/api/auth', authRoutes);
app.use('/api/predict', predictionRoutes);

// 💡 수정 1: 위에 선언한 이름과 똑같이 scrapeRouter로 연결!
app.use('/api/scrape', scrapeRouter); 

// 기본 경로 확인
app.get('/', (req, res) => {
  res.send('Election Predictor API Server is running...');
});

// 💡 수정 2: Render가 찔러주는 동적 PORT를 받아 무조건 서버를 실행하도록 조건문 제거
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
});

// Vercel이 백엔드를 인식할 수 있도록 반드시 추가해야 하는 한 줄! (그대로 둠)
module.exports = app;