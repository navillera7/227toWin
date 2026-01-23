const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth'); // JWT 검증 미들웨어
const RegionStat = require('../models/RegionStat');
// 유효한 정당 리스트 (selectable: true인 정당 ID들)
const VALID_PARTIES = ['undecided', 'dp', 'ppp', 'reform', 'cho', 'pro', 'mu'];

// 예측 제출
router.post('/submit', auth, async (req, res) => {
    try {
      const { mapType, predictions } = req.body;
      const user = await User.findById(req.userId);
  
      if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
  
      // 1. 현재 유저의 예측 데이터 먼저 저장
      user.predictions[mapType] = predictions;
      await user.save();
  
      // 2. [핵심] 해당 mapType의 전체 통계 강제 재계산 (Migration 로직 통합)
      // 모든 유저의 특정 mapType 데이터를 가져와서 집계합니다.
      const allUsers = await User.find({}, { [`predictions.${mapType}`]: 1 });
      
      // 임시로 집계할 객체 생성
      const newGlobalStats = {}; // { "11010": { "dp": 5, "ppp": 3 }, ... }
  
      allUsers.forEach(u => {
        const userPreds = u.predictions[mapType];
        if (userPreds) {
          for (const [regionId, partyId] of userPreds.entries()) {
            if (!newGlobalStats[regionId]) newGlobalStats[regionId] = {};
            newGlobalStats[regionId][partyId] = (newGlobalStats[regionId][partyId] || 0) + 1;
          }
        }
      });
  
      // 3. 계산된 결과를 RegionStat 컬렉션에 한꺼번에 업데이트
      const bulkOps = Object.keys(newGlobalStats).map(regionId => ({
        updateOne: {
          filter: { mapType, regionId },
          update: { $set: { partyStats: newGlobalStats[regionId] } },
          upsert: true
        }
      }));
  
      if (bulkOps.length > 0) {
        await RegionStat.bulkWrite(bulkOps);
      }
  
      res.json({ message: '예측이 저장되었으며, 전체 통계가 동기화되었습니다.' });
    } catch (err) {
      console.error("제출 중 오류:", err);
      res.status(500).json({ message: '서버 오류로 통계 갱신에 실패했습니다.' });
    }
  });
router.get('/my', auth, async (req, res) => {
    try {
      const user = await User.findById(req.userId).select('predictions');
      if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
      res.json(user.predictions);
    } catch (err) {
      res.status(500).json({ message: '데이터를 불러오는 중 오류가 발생했습니다.' });
    }
  });

  // 2. 지역별 실시간 통계 가져오기 (MongoDB Aggregation 사용)
// server/routes/predictions.js

router.get('/stats/:mapType/:regionId', async (req, res) => {
    try {
      const { mapType, regionId } = req.params;
      
      // 1. 데이터 찾기
      const stat = await RegionStat.findOne({ mapType, regionId });
  
      // 2. 데이터가 없는 경우 빈 배열 반환 (500 에러 방지)
      if (!stat || !stat.partyStats) {
        return res.json([]);
      }
  
      // 3. Map 객체를 일반 객체로 변환 후 포맷팅
      // .toJSON()이나 .get() 사용 시 안전하게 처리
      const statsObj = stat.partyStats instanceof Map 
        ? Object.fromEntries(stat.partyStats) 
        : stat.partyStats;
  
      const formattedStats = Object.entries(statsObj)
        .map(([id, count]) => ({ _id: id, count }))
        .filter(s => s.count > 0);
  
      res.json(formattedStats);
    } catch (err) {
      console.error("통계 조회 중 서버 에러:", err);
      res.status(500).json({ message: '서버 내부 오류' });
    }
  });
router.post('/save', auth, async (req, res) => {
    try {
      const { mapType, regionId, newPartyId } = req.body;
      const user = await User.findById(req.userId);
  
      // 1. 기존 예측 데이터 확인
      const oldPartyId = user.predictions[mapType].get(regionId);
  
      // 2. 유저의 개인 예측 데이터 업데이트
      user.predictions[mapType].set(regionId, newPartyId);
      await user.save();
  
      // 3. 통계 데이터(RegionStat) 증감 처리 (Atomic Update)
      const updateQuery = {};
      if (oldPartyId) {
        updateQuery[`partyStats.${oldPartyId}`] = -1; // 기존 정당 -1
      }
      updateQuery[`partyStats.${newPartyId}`] = 1;    // 새 정당 +1
  
      await RegionStat.findOneAndUpdate(
        { mapType, regionId },
        { $inc: updateQuery },
        { upsert: true, new: true }
      );
  
      res.json({ message: '예측이 저장되고 통계가 반영되었습니다.' });
    } catch (err) {
      res.status(500).json({ message: '저장 중 오류가 발생했습니다.' });
    }
  });
module.exports = router;