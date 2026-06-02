// api/index.js
// Vercel이 이 파일을 백엔드 진입점으로 인식하고, 기존 server.js로 연결해줍니다.
const app = require('../server/server.js');
module.exports = app;