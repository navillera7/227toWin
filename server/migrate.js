// server/migrate.js
const mongoose = require('mongoose');
const User = require('./models/User');
const RegionStat = require('./models/RegionStat');
require('dotenv').config();

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("시작: 기존 유저 데이터를 바탕으로 통계 재구축...");

  // 1. 기존 통계 초기화
  await RegionStat.deleteMany({});

  // 2. 모든 유저 가져오기
  const users = await User.find({});
  
  for (const user of users) {
    if (!user.predictions) continue;

    // metro와 local 데이터 각각 처리
    for (const mapType of ['metro', 'local']) {
      const typeData = user.predictions[mapType];
      if (!typeData) continue;

      for (const [regionId, partyId] of typeData) {
        await RegionStat.findOneAndUpdate(
          { mapType, regionId },
          { $inc: { [`partyStats.${partyId}`]: 1 } },
          { upsert: true }
        );
      }
    }
  }

  console.log("완료: 모든 통계 데이터가 동기화되었습니다.");
  process.exit();
}

migrate();