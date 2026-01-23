const mongoose = require('mongoose');

const regionStatSchema = new mongoose.Schema({
  mapType: { type: String, required: true }, // 'metro' 또는 'local'
  regionId: { type: String, required: true }, // 지역 코드
  partyStats: {
    type: Map,
    of: Number, // { "dp": 120, "ppp": 95, ... }
    default: {}
  }
}, { timestamps: true });

// 복합 인덱스로 검색 속도 최적화
regionStatSchema.index({ mapType: 1, regionId: 1 }, { unique: true });

module.exports = mongoose.model('RegionStat', regionStatSchema);