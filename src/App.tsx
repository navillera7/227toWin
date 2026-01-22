import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 정당 색상 및 이름 정의
const PARTIES = [
  { id: 'undecided', name: '미정', color: '#e0e0e0', selectable: true, abbr: '미정' },
  { id: 'dp', name: '더불어민주당', color: '#004ea2', selectable: true, abbr: '민주' },
  { id: 'ppp', name: '국민의힘', color: '#e61e2b', selectable: true, abbr: '국힘' },
  { id: 'reform', name: '개혁신당', color: '#EE7B1E', selectable: true, abbr: '개' },
  // 과거 정당은 표시용으로만 남겨두고 클릭 순환에서는 제외
  { id: 'liberty', name: '자유한국당', color: '#C9151E', selectable: false, abbr: '한국' },
  { id: 'sae', name: '새누리당', color: '#C9252B', selectable: false, abbr: '새누리' },
  { id: 'saejungchi', name: '새정치민주연합', color: '#0082CD', selectable: false, abbr: '새정연' },
  { id: 'mu', name: '무소속', color: '#000000', selectable: false, abbr: '무' },
  { id: 'united', name: '미래통합당', color: '#EF426F', selectable: false, abbr: '통합' },
  { id: 'pyung', name: '민주평화당', color: '#43B02A', selectable: false, abbr: '평화' },
  { id: 'cho', name: '조국혁신당', color: '#06275E', selectable: true, abbr: '혁신' },
  { id: 'pro', name: '진보당', color: '#8000FF', selectable: true, abbr: '진보' },
  { id: 'ddp', name: '더불어민주당', color: '#004ea2', selectable: false, abbr: '더민주' }, 
  { id: 'people', name: '국민의당', color: '#006241', selectable: false, abbr: '국민' }
];

interface CandidateInfo {
  cand1: { name: string; party: string };
  cand2: { name: string; party: string };
  pastResults: { year: string; winner: string; party: string }[];
  byElections: { year: string; winner: string; party: string }[]; // 새 필드 추가
}

interface PredictionState {
  [key: string]: {
    prediction: string;
    info?: CandidateInfo;
  };
}

const ZoomControl: React.FC = () => {
  const map = useMap();
  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <button onClick={() => map.zoomIn()} className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded shadow-lg border border-gray-300">+</button>
      <button onClick={() => map.zoomOut()} className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded shadow-lg border border-gray-300">−</button>
    </div>
  );
};

const KoreanElectionPredictor: React.FC = () => {
  const [mapType, setMapType] = useState<'metro' | 'local'>('metro');
  const [predictions, setPredictions] = useState<PredictionState>({});
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. CSV 데이터 로드 및 초기화
  const loadCandidateData = async () => {
    try {
      const response = await fetch('/candidates.csv');
      const csvText = await response.text();
      const rows = csvText.split('\n').filter(row => row.trim() !== '').slice(1);
      
      const newData: PredictionState = {};
      rows.forEach(row => {
        // 13번째 컬럼(byElecStr) 추가
        const [id, name, c1n, c1p, c2n, c2p, p22w, p22p, p18w, p18p, p14w, p14p, byElecStr] = row.split(',').map(s => s.trim());
        
        // "20: dp 장신상; 21: ppp 김철수" 형태 파싱
        const byElections = byElecStr ? byElecStr.split(';').map(item => {
          const parts = item.trim().split(':');
          if (parts.length < 2) return null;
          const year = parts[0].trim();
          const rest = parts[1].trim().split(' ');
          const party = rest[0];
          const winner = rest.slice(1).join(' ');
          return { year: `'${year}`, winner, party };
        }).filter((x): x is {year: string, winner: string, party: string} => x !== null) : [];
  
        if (id) {
          newData[id] = {
            prediction: 'undecided',
            info: {
              cand1: { name: c1n, party: c1p },
              cand2: { name: c2n, party: c2p },
              pastResults: [
                { year: '2022', winner: p22w, party: p22p },
                { year: '2018', winner: p18w, party: p18p },
                { year: '2014', winner: p14w, party: p14p }
              ],
              byElections // 파싱된 데이터 저장
            }
          };
        }
      });
      setPredictions(newData);
    } catch (err) {
      console.error("CSV 로드 실패:", err);
    }
  };

  // 2. 지리 데이터(GeoJSON) 유효성 검사
  const isValidGeometry = (feature: any) => {
    if (!feature.geometry || !feature.geometry.coordinates) return false;
    const { type, coordinates } = feature.geometry;
    try {
      if (type === 'Polygon') return Array.isArray(coordinates[0][0]);
      if (type === 'MultiPolygon') return Array.isArray(coordinates[0][0][0]);
      return true;
    } catch (e) { return false; }
  };

  // 3. 지도 및 데이터 업데이트
  useEffect(() => {
    setLoading(true);
    loadCandidateData();
    
    const fileName = mapType === 'metro' ? 'metro_fixed.json' : 'local_fixed.json';
    fetch(`/${fileName}`)
      .then(res => res.json())
      .then(data => {
        const validFeatures = data.features.filter((f: any) => isValidGeometry(f));
        setGeoData({ ...data, features: validFeatures });
        setLoading(false);
      });
  }, [mapType]);

  // 클릭 시 예측값 변경
  const handleRegionClick = (id: string) => {
    // 1. 순환 가능한 정당들만 필터링
    const selectableParties = PARTIES.filter(p => p.selectable);
    
    setPredictions(prev => {
      const currentId = prev[id]?.prediction || 'undecided';
      
      // 2. 현재 정당이 순환 리스트 중 몇 번째인지 찾기
      // 만약 현재 정당이 과거 정당(selectable: false)이라면 -1이 반환되므로 '미정'부터 시작하게 됩니다.
      const currentIndex = selectableParties.findIndex(p => p.id === currentId);
      
      // 3. 다음 순서 정당의 ID 결정
      const nextIndex = (currentIndex + 1) % selectableParties.length;
      const nextPartyId = selectableParties[nextIndex].id;
      
      return {
        ...prev,
        [id]: { ...prev[id], prediction: nextPartyId }
      };
    });
  };
  // 정당별 통계 계산
  const getStatistics = () => {
    const stats: { [key: string]: number } = {};
    
    // 1. 선택 가능한(현재의) 정당들만 통계 대상에 포함
    PARTIES.filter(p => p.selectable).forEach(p => {
      stats[p.id] = 0;
    });
    
    // 2. 현재 지도에 표시된 지역들의 예측 정당 카운트
    geoData?.features.forEach((f: any) => {
      const pred = predictions[f.properties.id]?.prediction || 'undecided';
      // 만약 현재 예측값이 'selectable' 정당 리스트에 있다면 숫자를 올림
      if (stats[pred] !== undefined) {
        stats[pred]++;
      }
    });
    
    return stats;
  };

  const stats = getStatistics();

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50">
      {/* 상단 헤더: 제목, 전환 버튼, 통계 요약 */}
      <div className="bg-white shadow-md p-4 z-10">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">2025 지방선거 예측</h1>
        
        {/* 기초/광역 전환 버튼 */}
        <div className="flex justify-center gap-2 mb-4">
          <button 
            onClick={() => setMapType('metro')} 
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${mapType === 'metro' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            광역단위
          </button>
          <button 
            onClick={() => setMapType('local')} 
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${mapType === 'local' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            기초단위
          </button>
        </div>

        {/* 정당별 요약 통계 */}
        {/* 정당별 요약 통계 영역 */}
<div className="flex justify-center gap-4 flex-wrap">
  {PARTIES.filter(party => party.selectable).map(party => (
    <div key={party.id} className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: party.color }} />
      <span className="text-xs font-medium text-gray-700">{party.name}</span>
      <span className="text-sm font-bold text-blue-600">
        {stats[party.id] || 0}
      </span>
    </div>
  ))}
</div>
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative overflow-hidden">
        {!loading && geoData && (
          <MapContainer key={mapType} center={[36.3, 127.8]} zoom={7} className="w-full h-full" zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            <GeoJSON 
              key={`${mapType}-${geoData.features.length}`}
              data={geoData} 
              style={(f) => ({
                fillColor: PARTIES.find(p => p.id === (predictions[f?.properties.id]?.prediction || 'undecided'))?.color,
                weight: 1, color: hoveredRegionId === f?.properties.id ? '#000' : '#888',
                fillOpacity: hoveredRegionId === f?.properties.id ? 0.8 : 0.6
              })}
              onEachFeature={(feature, layer) => {
                layer.on({
                  click: (e) => { L.DomEvent.stopPropagation(e); handleRegionClick(feature.properties.id); },
                  mouseover: (e) => {
                    setHoveredRegionId(feature.properties.id);
                    setTooltipPosition({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
                  },
                  mouseout: () => setHoveredRegionId(null),
                  mousemove: (e) => setTooltipPosition({ x: e.originalEvent.clientX, y: e.originalEvent.clientY })
                });
              }} 
            />
            <ZoomControl />
          </MapContainer>
        )}

        {/* 툴팁: 후보자 정보 + 과거 3회 결과 */}
        {hoveredRegionId && (
          <div 
          className="fixed bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-2xl border border-gray-200 z-[3000] w-72 pointer-events-none transition-transform duration-75"
          style={{ 
            left: `${tooltipPosition.x + 20}px`,
            // 마우스 좌표가 화면 높이의 60% 이상 내려가면 툴팁을 위로 올림
            top: tooltipPosition.y > window.innerHeight * 0.6 
              ? 'auto' 
              : `${tooltipPosition.y + 20}px`,
            bottom: tooltipPosition.y > window.innerHeight * 0.6 
              ? `${window.innerHeight - tooltipPosition.y + 20}px` 
              : 'auto',
          }}
        >
            <h3 className="font-extrabold text-lg text-gray-900 border-b pb-2 mb-3">
              {geoData.features.find((f: any) => f.properties.id === hoveredRegionId)?.properties.name}
            </h3>
            
            {predictions[hoveredRegionId]?.info ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">주요 후보자</p>
                  <div className="space-y-2">
                    {[predictions[hoveredRegionId].info?.cand1, predictions[hoveredRegionId].info?.cand2].map((c, i) => (
                      <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                        <span className="text-sm font-bold text-gray-700">{c?.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full text-white font-bold" style={{backgroundColor: PARTIES.find(p => p.id === c?.party)?.color}}>
                          {PARTIES.find(p => p.id === c?.party)?.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">역대 단체장</p>
  <div className="grid grid-cols-1 gap-1">
    {predictions[hoveredRegionId].info?.pastResults.map((r, i) => (
      <div key={i} className="flex items-center text-xs border-b border-gray-50 py-1.5">
        {/* 1. 연도: 고정 너비로 시작점 고정 */}
        <span className="text-gray-400 w-12 flex-shrink-0">{r.year}년</span>
        
        {/* 2. 당선인: 남은 공간을 차지하며 중앙 정렬 */}
        <span className="font-semibold text-gray-700 flex-1 text-center truncate px-2">
          {r.winner}
        </span>
        
        {/* 3. 정당 축약어: 가변 너비 뱃지로 수정 */}
        <div className="w-14 flex justify-end flex-shrink-0"> {/* 전체 너비를 14로 넉넉히 잡아 정렬 유지 */}
          <span 
            className="inline-block min-w-[24px] px-2 h-6 leading-6 text-center rounded-full font-bold text-white text-[10px] shadow-sm whitespace-nowrap" 
            style={{ backgroundColor: PARTIES.find(p => p.id === r.party)?.color }}
          >
            {PARTIES.find(p => p.id === r.party)?.abbr || '?' }
          </span>
        </div>
      </div>
    ))}
  </div>
</div>

{/* 과거 3회 당선 기록 아래에 추가 */}
{predictions[hoveredRegionId].info?.byElections && predictions[hoveredRegionId].info!.byElections.length > 0 && (
  <div className="mt-4">
    <p className="text-[10px] uppercase tracking-wider text-amber-500 font-bold mb-2">재보궐 선거 결과</p>
    <div className="grid grid-cols-1 gap-1">
      {predictions[hoveredRegionId].info?.byElections.map((r, i) => (
        <div key={i} className="flex items-center text-xs border-b border-amber-50 py-1.5">
          <span className="text-gray-400 w-12 flex-shrink-0">{r.year}</span>
          <span className="font-semibold text-gray-700 flex-1 text-center truncate px-2">
            {r.winner}
          </span>
          <div className="w-14 flex justify-end flex-shrink-0">
            <span 
              className="inline-block min-w-[24px] px-2 h-6 leading-6 text-center rounded-full font-bold text-white text-[10px] shadow-sm" 
              style={{ backgroundColor: PARTIES.find(p => p.id === r.party)?.color }}
            >
              {PARTIES.find(p => p.id === r.party)?.abbr || '?' }
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">CSV 데이터가 없습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KoreanElectionPredictor;