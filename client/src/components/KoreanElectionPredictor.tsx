import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // AuthContext 연동


const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// --- 기존 상수 및 타입 정의 유지 ---
const SIDO_MAP: { [key: string]: string } = {
  '11': '서울특별시', '26': '부산광역시', '27': '대구광역시', '28': '인천광역시',
  '29': '광주광역시', '30': '대전광역시', '31': '울산광역시', '36': '세종특별자치시',
  '41': '경기도', '51': '강원특별자치도', '43': '충청북도', '44': '충청남도',
  '45': '전북특별자치도', '46': '전라남도', '47': '경상북도', '48': '경상남도', '50': '제주특별자치도'
};

const PARTIES = [
  { id: 'undecided', name: '미정', color: '#e0e0e0', selectable: true, abbr: '미정' },
  { id: 'dp', name: '더불어민주당', color: '#004ea2', selectable: true, abbr: '민주' },
  { id: 'ppp', name: '국민의힘', color: '#e61e2b', selectable: true, abbr: '국힘' },
  { id: 'reform', name: '개혁신당', color: '#EE7B1E', selectable: true, abbr: '개혁' },
  { id: 'cho', name: '조국혁신당', color: '#06275E', selectable: true, abbr: '혁신' },
  { id: 'pro', name: '진보당', color: '#8000FF', selectable: true, abbr: '진보' },
  { id: 'mu', name: '무소속', color: '#000000', selectable: true, abbr: '무' },
  { id: 'liberty', name: '자유한국당', color: '#C9151E', selectable: false, abbr: '한국' },
  { id: 'sae', name: '새누리당', color: '#C9252B', selectable: false, abbr: '새누리' },
  { id: 'saejungchi', name: '새정치민주연합', color: '#0082CD', selectable: false, abbr: '새정연' },
  { id: 'united', name: '미래통합당', color: '#EF426F', selectable: false, abbr: '통합' },
  { id: 'pyung', name: '민주평화당', color: '#43B02A', selectable: false, abbr: '평화' },
  { id: 'ddp', name: '더불어민주당', color: '#004ea2', selectable: false, abbr: '더민주' }, 
  { id: 'people', name: '국민의당', color: '#006241', selectable: false, abbr: '국민' }, 
];

interface CandidateInfo {
  cand1: { name: string; party: string };
  cand2: { name: string; party: string };
  pastResults: { year: string; winner: string; party: string }[];
  byElections: { year: string; winner: string; party: string }[];
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
      <button onClick={() => map.zoomIn()} className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded shadow shadow-gray-300">+</button>
      <button onClick={() => map.zoomOut()} className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded shadow shadow-gray-300">−</button>
    </div>
  );
};

const KoreanElectionPredictor: React.FC = () => {
  // --- Auth 및 네비게이션 추가 ---
  const { token, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  // --- 기존 State 유지 ---
  const [mapType, setMapType] = useState<'metro' | 'local'>('metro');
  const [predictions, setPredictions] = useState<PredictionState>({});
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [isSidebarHover, setIsSidebarHover] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openSidos, setOpenSidos] = useState<string[]>(['11', '41', '28']);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [regionStats, setRegionStats] = useState<any[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  // 1. 기존 예측 데이터 불러오기 (로그인 상태일 때만)
  useEffect(() => {
    const fetchSavedData = async () => {
      if (!isAuthenticated || !token || loading) return; // 로딩 중이거나 미인증 시 중단
      try {
        const res = await fetch(`${API_BASE_URL}/api/predict/my`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const savedMap = data[mapType] || {};
          
          setPredictions(prev => {
            const next = { ...prev };
            Object.keys(savedMap).forEach(id => {
              if (next[id]) next[id].prediction = savedMap[id];
            });
            return next;
          });
        }
      } catch (err) { console.error("데이터 로드 실패:", err); }
    };
    fetchSavedData();
  }, [isAuthenticated, token, mapType, loading]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!hoveredRegionId) {
        setRegionStats([]);
        return;
      }
      
      setIsStatsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/predict/stats/${mapType}/${hoveredRegionId}`);
        if (res.ok) {
          const data = await res.json();
          // 정렬: 예측 인원 많은 순서대로
          setRegionStats(data.sort((a: any, b: any) => b.count - a.count));
        }
      } catch (err) {
        console.error("통계 로드 실패:", err);
      } finally {
        setIsStatsLoading(false);
      }
    };
  
    const timer = setTimeout(fetchStats, 100); // 짧은 디바운싱으로 성능 최적화
    return () => clearTimeout(timer);
  }, [hoveredRegionId, mapType]);
  // 2. 예측 제출 핸들러 추가
  const handleReset = () => {
    if (window.confirm("모든 지역의 예측을 초기화하시겠습니까?")) {
      setPredictions(prev => {
        const resetData = { ...prev };
        // 모든 키값을 순회하며 prediction을 'undecided'로 변경
        Object.keys(resetData).forEach(id => {
          resetData[id] = { ...resetData[id], prediction: 'undecided' };
        });
        return resetData;
      });
    }
  };
  const handleSubmit = async () => {
    if (!isAuthenticated) {
      alert("제출하려면 먼저 로그인해야 합니다.");
      navigate('/login');
      return;
    }


    const featureIds = geoData.features.map((f: any) => String(f.properties.id));
    const currentPredictions: { [key: string]: string } = {};

    // 검증: 모든 지역 선택 및 유효한 정당 확인
    for (const id of featureIds) {
      const pred = predictions[id]?.prediction || 'undecided';
      if (pred === 'undecided') {
        alert("모든 지역의 예측을 완료한 후 제출해주세요.");
        return;
      }
      const party = PARTIES.find(p => p.id === pred);
      if (!party || !party.selectable) {
        alert("유효하지 않은 정당(과거 정당 등)이 선택된 지역이 있습니다.");
        return;
      }
      currentPredictions[id] = pred;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/predict/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ mapType, predictions: currentPredictions, totalCount: featureIds.length })
      });
      if (res.ok) alert("예측 결과가 성공적으로 저장되었습니다!");
      else alert("저장에 실패했습니다.");
    } catch (err) { alert("서버 통신 오류가 발생했습니다."); }
  };

  // --- 기존 함수 유지 (applyPastResult, loadCandidateData 등) ---
  const applyPastResult = (year: string) => {
    setPredictions(prev => {
      const nextPredictions = { ...prev };
      Object.keys(nextPredictions).forEach(id => {
        const regionInfo = nextPredictions[id].info;
        if (regionInfo && regionInfo.pastResults) {
          const pastRecord = regionInfo.pastResults.find(r => r.year === year);
          if (pastRecord && pastRecord.party) {
            nextPredictions[id] = { ...nextPredictions[id], prediction: pastRecord.party };
          }
        }
      });
      return nextPredictions;
    });
  };

  const loadCandidateData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/candidates.csv`);
      const csvText = await response.text();
      const rows = csvText.split('\n').filter(row => row.trim() !== '').slice(1);
      const newData: PredictionState = {};
      rows.forEach(row => {
        const [id, _name, c1n, c1p, c2n, c2p, p22w, p22p, p18w, p18p, p14w, p14p, byElecStr] = row.split(',').map(s => s.trim());
        const byElections = byElecStr ? byElecStr.split(';').map(item => {
          const parts = item.trim().split(':');
          if (parts.length < 2) return null;
          const year = parts[0].trim();
          const rest = parts[1].trim().split(' ');
          return { year: `'${year}`, party: rest[0], winner: rest.slice(1).join(' ') };
        }).filter((x): x is any => x !== null) : [];

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
              byElections
            }
          };
        }
      });
      setPredictions(newData);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    setLoading(true);
    loadCandidateData();
    const fileName = mapType === 'metro' ? 'metro_fixed.json' : 'local_fixed.json';
    fetch(`${API_BASE_URL}/${fileName}`)
      .then(res => res.json())
      .then(data => {
        setGeoData(data);
        setLoading(false);
      });
  }, [mapType]);

  const handleRegionClick = (id: string) => {
    if (!selectedPartyId) return;
    setPredictions(prev => ({
      ...prev,
      [id]: { ...prev[id], prediction: selectedPartyId }
    }));
  };

  const getStatistics = () => {
    const stats: { [key: string]: number } = {};
    PARTIES.filter(p => p.selectable).forEach(p => stats[p.id] = 0);
    geoData?.features.forEach((f: any) => {
      const pred = predictions[f.properties.id]?.prediction || 'undecided';
      if (stats[pred] !== undefined) stats[pred]++;
    });
    return stats;
  };

  const groupedRegions = useMemo(() => {
    if (!geoData) return {};
    const groups: { [key: string]: any[] } = {};
    geoData.features.forEach((f: any) => {
      const id = String(f.properties.id);
      const name = f.properties.name;
      if (name.includes(searchTerm)) {
        const groupKey = mapType === 'metro' ? 'flat' : id.substring(0, 2);
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push({ id, name });
      }
    });
    Object.keys(groups).forEach(key => groups[key].sort((a, b) => a.name.localeCompare(b.name)));
    return groups;
  }, [geoData, searchTerm, mapType]);

  const toggleSido = (sidoId: string) => {
    setOpenSidos(prev => prev.includes(sidoId) ? prev.filter(id => id !== sidoId) : [...prev, sidoId]);
  };

  const stats = getStatistics();

  return (
    <div className={`w-full h-screen flex flex-col bg-gray-50 overflow-hidden font-sans ${selectedPartyId ? 'cursor-crosshair' : ''}`}>
      <div className="bg-white shadow-sm p-4 z-20 text-center border-b relative">
        <h1 className="text-xl sm:text-2xl font-bold mb-4">2026 지방선거 예측 지도</h1>
        <div className="absolute right-4 top-4 flex gap-2">
          {isAuthenticated ? (
            <button onClick={logout} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-bold text-xs hover:bg-gray-200 transition-all">로그아웃</button>
          ) : (
            <Link to="/login" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs shadow-sm hover:bg-blue-700 transition-all">로그인</Link>
          )}
          <Link to="/poll" className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-100 text-blue-600 rounded-lg font-bold text-xs shadow-sm hover:bg-blue-50 transition-all">
            📊 <span>여론조사</span>
          </Link>
        </div>
        <div className="flex justify-center gap-2">
          <button onClick={() => setMapType('metro')} className={`px-4 py-1.5 rounded-full font-bold text-sm ${mapType === 'metro' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>광역단위</button>
          <button onClick={() => setMapType('local')} className={`px-4 py-1.5 rounded-full font-bold text-sm ${mapType === 'local' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>기초단위</button>
        </div>
      </div>

      <div className="flex justify-center gap-2 items-center py-2 bg-gray-50/50">
        <span className="text-[11px] font-bold text-gray-400 mr-1">과거 기록 불러오기:</span>
        {['2022', '2018', '2014'].map(year => (
          <button key={year} onClick={() => applyPastResult(year)} className="px-3 py-1 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-500 rounded text-[11px] font-bold transition-colors shadow-sm">{year}년</button>
        ))}
      </div>

      <div className="flex-1 flex flex-row overflow-hidden relative">
        <div className="hidden sm:flex w-72 md:w-80 bg-white border-r flex-col z-10 shadow-inner">
          <div className="p-4 border-b bg-gray-50/50">
            <input type="text" placeholder="지역 검색..." className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {Object.keys(groupedRegions).sort().map(groupKey => (
              <div key={groupKey} className="border-b border-gray-100">
                {mapType === 'local' && (
                  <div onClick={() => toggleSido(groupKey)} className="flex items-center justify-between px-4 py-3 bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors">
                    <span className="text-sm font-bold text-gray-700">{SIDO_MAP[groupKey] || '기타'} <span className="ml-2 text-[10px] text-blue-500 font-normal">{groupedRegions[groupKey].length}</span></span>
                    <span className="text-gray-400 text-[10px]">{openSidos.includes(groupKey) ? '▲' : '▼'}</span>
                  </div>
                )}
                {(mapType === 'metro' || openSidos.includes(groupKey)) && (
                  <div className="bg-white">
                    {groupedRegions[groupKey].map((region) => {
                      const party = PARTIES.find(p => p.id === (predictions[region.id]?.prediction || 'undecided'));
                      return (
                        <div key={region.id} onClick={() => handleRegionClick(region.id)} onMouseEnter={(e) => { setHoveredRegionId(region.id); setIsSidebarHover(true); setTooltipPosition({ x: 0, y: e.clientY }); }} onMouseLeave={() => { setHoveredRegionId(null); setIsSidebarHover(false); }}
                          className={`flex items-center justify-between px-6 py-2.5 border-b border-gray-50 cursor-pointer transition-all ${hoveredRegionId === region.id ? 'bg-blue-50/80 border-l-4 border-l-blue-500 pl-5' : 'hover:bg-gray-50 pl-6'}`}
                        >
                          <span className="text-xs font-bold text-gray-600">{region.name}</span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full text-white font-extrabold min-w-[40px] text-center shadow-sm" style={{ backgroundColor: party?.color }}>{party?.abbr}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 relative bg-blue-50/20">
          {!loading && geoData && (
            <MapContainer center={[36.3, 127.8]} zoom={7} className="w-full h-full z-0" zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <GeoJSON 
                key={`${mapType}-${geoData.features.length}-${selectedPartyId}`}
                data={geoData} 
                style={(f) => ({
                  fillColor: PARTIES.find(p => p.id === (predictions[f?.properties.id]?.prediction || 'undecided'))?.color,
                  weight: 1, 
                  color: hoveredRegionId === f?.properties.id ? '#000' : '#888',
                  fillOpacity: hoveredRegionId === f?.properties.id ? 0.8 : 0.6
                })}
                onEachFeature={(feature, layer) => {
                  layer.on({
                    click: (e) => { L.DomEvent.stopPropagation(e); handleRegionClick(feature.properties.id); },
                    mouseover: (e) => { setHoveredRegionId(feature.properties.id); setIsSidebarHover(false); setTooltipPosition({ x: e.originalEvent.clientX, y: e.originalEvent.clientY }); },
                    mouseout: () => setHoveredRegionId(null),
                    mousemove: (e) => setTooltipPosition({ x: e.originalEvent.clientX, y: e.originalEvent.clientY })
                  });
                }} 
              />
              <ZoomControl />
            </MapContainer>
          )}

          
          {hoveredRegionId && (
            <div className="fixed bg-white/95 backdrop-blur-sm p-3 sm:p-4 rounded-xl shadow-2xl border border-gray-200 z-[3000] w-60 sm:w-72 pointer-events-none transition-transform duration-75"
              style={{ left: isSidebarHover ? '330px' : tooltipPosition.x > window.innerWidth * 0.5 ? `${tooltipPosition.x - (window.innerWidth > 640 ? 300 : 250)}px` : `${tooltipPosition.x + 10}px`, top: tooltipPosition.y > window.innerHeight * 0.6 ? 'auto' : `${tooltipPosition.y + 10}px`, bottom: tooltipPosition.y > window.innerHeight * 0.6 ? `${window.innerHeight - tooltipPosition.y + 10}px` : 'auto', }}
            >
              <h3 className="font-extrabold text-sm sm:text-lg text-gray-900 border-b pb-1.5 mb-3">
                {(() => {
                  const feature = geoData.features.find((f: any) => String(f.properties.id) === String(hoveredRegionId));
                  if (!feature) return "지역 정보 없음";
                  const regionName = feature.properties.name || feature.properties.SIG_KOR_NM || "";
                  if (mapType === 'local') {
                    const sidoId = String(hoveredRegionId).substring(0, 2);
                    return `${SIDO_MAP[sidoId] || ""} ${regionName}`;
                  }
                  return regionName;
                })()}
              </h3>
              <div className="mt-4 pt-4 border-t border-gray-100">
  <p className="text-[10px] font-extrabold text-blue-600 mb-2 uppercase tracking-tight flex items-center gap-1">
    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
    유저 실시간 예측 현황
  </p>
  
  {isStatsLoading ? (
    <div className="space-y-2 py-2">
      <div className="h-3 bg-gray-100 animate-pulse rounded-full w-full"></div>
      <div className="h-3 bg-gray-100 animate-pulse rounded-full w-3/4"></div>
    </div>
  ) : regionStats.length > 0 ? (
    <div className="space-y-2">
      {regionStats.map((s: any) => {
        const party = PARTIES.find(p => p.id === s._id);
        const total = regionStats.reduce((acc, cur) => acc + cur.count, 0);
        const percentage = Math.round((s.count / total) * 100);
        
        return (
          <div key={s._id} className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center text-[9px] font-bold">
              <span className="text-gray-600">{party?.abbr || '기타'}</span>
              <span className="text-gray-400">{s.count}명 ({percentage}%)</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full transition-all duration-700 ease-out" 
                style={{ 
                  width: `${percentage}%`, 
                  backgroundColor: party?.color || '#cbd5e1' 
                }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[8px] text-gray-400 text-right mt-1 font-medium italic">
        총 {regionStats.reduce((acc, cur) => acc + cur.count, 0)}명의 유저가 참여함
      </p>
    </div>
  ) : (
    <p className="text-[9px] text-gray-400 italic py-2 text-center">아직 이 지역의 예측 데이터가 없습니다.</p>
  )}
</div>
              {predictions[hoveredRegionId]?.info ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">주요 후보자</p>
                    <div className="space-y-1.5">
                      {[predictions[hoveredRegionId].info?.cand1, predictions[hoveredRegionId].info?.cand2].map((c, i) => (
                        <div key={i} className="flex justify-between items-center bg-gray-50 p-1.5 sm:p-2 rounded-md border border-gray-100">
                          <span className="text-xs sm:text-sm font-bold text-gray-700">{c?.name}</span>
                          <span className="text-[8px] sm:text-[10px] px-2 py-0.5 rounded-full text-white font-bold" style={{backgroundColor: PARTIES.find(p => p.id === c?.party)?.color}}>
                            {PARTIES.find(p => p.id === c?.party)?.abbr}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">과거 3회 당선 기록</p>
                    <div className="space-y-1 mb-3">
                      {predictions[hoveredRegionId].info?.pastResults.map((r, i) => (
                        <div key={i} className="flex items-center text-[11px] sm:text-xs border-b border-gray-50 py-1.5">
                          <span className="text-gray-400 w-8 sm:w-12 flex-shrink-0">{r.year}</span>
                          <span className="font-bold text-gray-700 flex-1 text-center truncate px-2">{r.winner}</span>
                          <div className="w-10 sm:w-14 flex justify-end">
                            <span className="inline-block min-w-[20px] sm:min-w-[24px] px-1.5 h-5 sm:h-6 leading-5 sm:leading-6 text-center rounded-full font-bold text-white text-[8px] sm:text-[10px] shadow-sm" style={{ backgroundColor: PARTIES.find(p => p.id === r.party)?.color }}>
                              {PARTIES.find(p => p.id === r.party)?.abbr || '?'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {predictions[hoveredRegionId].info?.byElections && predictions[hoveredRegionId].info!.byElections.length > 0 && (
                      <div>
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-500 font-bold mb-2">재보궐 선거 결과</p>
                        <div className="space-y-1">
                          {predictions[hoveredRegionId].info?.byElections.map((r, i) => (
                            <div key={i} className="flex items-center text-[11px] sm:text-xs border-b border-amber-50 py-1.5 bg-amber-50/20">
                              <span className="text-amber-600 w-8 sm:w-12 flex-shrink-0 font-medium">{r.year}</span>
                              <span className="font-bold text-gray-700 flex-1 text-center truncate px-2">{r.winner}</span>
                              <div className="w-10 sm:w-14 flex justify-end">
                                <span className="inline-block min-w-[20px] sm:min-w-[24px] px-1.5 h-5 sm:h-6 leading-5 sm:leading-6 text-center rounded-full font-bold text-white text-[8px] sm:text-[10px]" style={{ backgroundColor: PARTIES.find(p => p.id === r.party)?.color }}>
                                  {PARTIES.find(p => p.id === r.party)?.abbr}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">CSV 데이터가 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border-t p-2 sm:p-3 flex items-center justify-between px-4 sm:px-10">
        <div className="flex gap-3 sm:gap-6 text-[10px] sm:text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-hide flex-1 justify-center">
          {PARTIES.filter(p => p.selectable).map(party => (
            <div 
              key={party.id} 
              onClick={() => setSelectedPartyId(prev => prev === party.id ? null : party.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border cursor-pointer transition-all shadow-sm
                ${selectedPartyId === party.id 
                  ? 'bg-white border-blue-500 ring-2 ring-blue-100 scale-105 shadow-md' 
                  : 'bg-gray-100 border-gray-100 hover:bg-gray-200'}`}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: party.color}} />
              <span className="text-gray-600">{party.abbr}</span>
              <span className="text-blue-600 font-extrabold">{stats[party.id] || 0}</span>
            </div>
          ))}
        </div>
    <button 
      onClick={handleReset}
      className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 active:scale-95 transition-all"
    >
      초기화
    </button>
        <button 
          onClick={handleSubmit}
          className="ml-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex-shrink-0"
        >
          {isAuthenticated ? "예측 제출하기" : "로그인 후 제출"}
        </button>
      </div>
    </div>
  );
};

export default KoreanElectionPredictor;