import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// KoreanElectionPredictor.tsx 상단에 추가
import { Link } from 'react-router-dom';



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
  { id: 'liberty', name: '자유한국당', color: '#C9151E', selectable: false, abbr: '한국' },
  { id: 'sae', name: '새누리당', color: '#C9252B', selectable: false, abbr: '새누리' },
  { id: 'saejungchi', name: '새정치민주연합', color: '#0082CD', selectable: false, abbr: '새정연' },
  
  { id: 'united', name: '미래통합당', color: '#EF426F', selectable: false, abbr: '통합' },
  { id: 'pyung', name: '민주평화당', color: '#43B02A', selectable: false, abbr: '평화' },
  { id: 'cho', name: '조국혁신당', color: '#06275E', selectable: true, abbr: '혁신' },
  { id: 'pro', name: '진보당', color: '#8000FF', selectable: true, abbr: '진보' },
  { id: 'ddp', name: '더불어민주당', color: '#004ea2', selectable: false, abbr: '더민주' }, 
  { id: 'people', name: '국민의당', color: '#006241', selectable: false, abbr: '국민' }, 
  { id: 'mu', name: '무소속', color: '#000000', selectable: true, abbr: '무' },
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
  const [mapType, setMapType] = useState<'metro' | 'local'>('metro');
  const [predictions, setPredictions] = useState<PredictionState>({});
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [isSidebarHover, setIsSidebarHover] = useState(false); // 사이드바 호버 여부
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openSidos, setOpenSidos] = useState<string[]>(['11', '41', '28']);
  // App.tsx 내부의 기존 함수들 아래에 추가하세요.

const applyPastResult = (year: string) => {
  setPredictions(prev => {
    const nextPredictions = { ...prev };
    
    Object.keys(nextPredictions).forEach(id => {
      const regionInfo = nextPredictions[id].info;
      if (regionInfo && regionInfo.pastResults) {
        // 선택한 연도와 일치하는 기록 찾기
        const pastRecord = regionInfo.pastResults.find(r => r.year === year);
        
        if (pastRecord && pastRecord.party) {
          // 해당 연도의 정당 ID를 현재 예측값(prediction)으로 설정
          nextPredictions[id] = {
            ...nextPredictions[id],
            prediction: pastRecord.party
          };
        }
      }
    });
    
    return nextPredictions;
  });
};

  const loadCandidateData = async () => {
    try {
      const response = await fetch('/candidates.csv');
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
    fetch(`/${fileName}`)
      .then(res => res.json())
      .then(data => {
        setGeoData(data);
        setLoading(false);
      });
  }, [mapType]);

  const handleRegionClick = (id: string) => {
    const selectableParties = PARTIES.filter(p => p.selectable);
    setPredictions(prev => {
      const current = prev[id]?.prediction || 'undecided';
      const nextIndex = (selectableParties.findIndex(p => p.id === current) + 1) % selectableParties.length;
      return { ...prev, [id]: { ...prev[id], prediction: selectableParties[nextIndex].id } };
    });
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
      const id = String(f.properties.id); // ID 타입 에러 방지
      const name = f.properties.name;
      
      if (name.includes(searchTerm)) {
        // 광역단위일 때는 그룹화하지 않고 'flat' 키로 통합
        const groupKey = mapType === 'metro' ? 'flat' : id.substring(0, 2);
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push({ id, name });
      }
    });

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [geoData, searchTerm, mapType]);

  const toggleSido = (sidoId: string) => {
    setOpenSidos(prev => 
      prev.includes(sidoId) ? prev.filter(id => id !== sidoId) : [...prev, sidoId]
    );
  };

  const stats = getStatistics();

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50 overflow-hidden font-sans">
      <div className="bg-white shadow-sm p-4 z-20 text-center border-b">
        <h1 className="text-xl sm:text-2xl font-bold mb-4">2026 지방선거 예측 지도</h1>
        <div className="absolute right-4 top-4 sm:top-6">
          <Link 
            to="/poll" 
            className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white border border-blue-100 text-blue-600 rounded-xl font-bold text-xs sm:text-sm shadow-sm hover:bg-blue-50 hover:border-blue-300 transition-all"
          >
            <span className="hidden xs:inline">📊</span> 
            <span>여론조사 현황</span>
          </Link>
        </div>
        <div className="flex justify-center gap-2">
          <button onClick={() => setMapType('metro')} className={`px-4 py-1.5 rounded-full font-bold text-sm ${mapType === 'metro' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>광역단위</button>
          <button onClick={() => setMapType('local')} className={`px-4 py-1.5 rounded-full font-bold text-sm ${mapType === 'local' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>기초단위</button>

        </div>
      </div>

      <div className="flex justify-center gap-2 items-center">
    <span className="text-[11px] font-bold text-gray-400 mr-1">과거 기록 불러오기:</span>
    {['2022', '2018', '2014'].map(year => (
      <button 
        key={year}
        onClick={() => applyPastResult(year)}
        className="px-3 py-1 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-500 rounded text-[11px] font-bold transition-colors shadow-sm"
      >
        {year}년
      </button>
    ))}
  </div>

      <div className="flex-1 flex flex-row overflow-hidden relative">
  
        <div className="hidden sm:flex w-72 md:w-80 bg-white border-r flex-col z-10 shadow-inner">
          <div className="p-4 border-b bg-gray-50/50">
            <input 
              type="text" 
              placeholder="지역 검색..." 
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {Object.keys(groupedRegions).sort().map(groupKey => (
              <div key={groupKey} className="border-b border-gray-100">
                {mapType === 'local' && (
                  <div 
                    onClick={() => toggleSido(groupKey)}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-bold text-gray-700">
                      {SIDO_MAP[groupKey] || '기타'} 
                      <span className="ml-2 text-[10px] text-blue-500 font-normal">{groupedRegions[groupKey].length}</span>
                    </span>
                    <span className="text-gray-400 text-[10px]">{openSidos.includes(groupKey) ? '▲' : '▼'}</span>
                  </div>
                )}

                {(mapType === 'metro' || openSidos.includes(groupKey)) && (
                  <div className="bg-white">
                    {groupedRegions[groupKey].map((region) => {
                      const party = PARTIES.find(p => p.id === (predictions[region.id]?.prediction || 'undecided'));
                      return (
                        <div 
                          key={region.id}
                          onClick={() => handleRegionClick(region.id)}
                          onMouseEnter={(e) => {
                            setHoveredRegionId(region.id);
                            setIsSidebarHover(true); // 사이드바 호버 상태 활성화
                            setTooltipPosition({ x: 0, y: e.clientY }); // Y좌표만 추적
                          }}
                          onMouseLeave={() => {
                            setHoveredRegionId(null);
                            setIsSidebarHover(false);
                          }}
                          className={`flex items-center justify-between px-6 py-2.5 border-b border-gray-50 cursor-pointer transition-all ${hoveredRegionId === region.id ? 'bg-blue-50/80 border-l-4 border-l-blue-500 pl-5' : 'hover:bg-gray-50 pl-6'}`}
                        >
                          <span className="text-xs font-bold text-gray-600">{region.name}</span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full text-white font-extrabold min-w-[40px] text-center shadow-sm" style={{ backgroundColor: party?.color }}>
                            {party?.abbr}
                          </span>
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
            <MapContainer key={mapType} center={[36.3, 127.8]} zoom={7} className="w-full h-full z-0" zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <GeoJSON 
                key={`${mapType}-${geoData.features.length}`}
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
                    mouseover: (e) => {
                      setHoveredRegionId(feature.properties.id);
                      setIsSidebarHover(false); // 지도 호버 상태
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

          {hoveredRegionId && (
            <div 
              className="fixed bg-white/95 backdrop-blur-sm p-3 sm:p-4 rounded-xl shadow-2xl border border-gray-200 z-[3000] w-60 sm:w-72 pointer-events-none transition-transform duration-75"
              style={{ 
                // 사이드바 호버 시 X좌표 고정, 지도 호버 시 동적 위치
                left: isSidebarHover 
                  ? '330px' 
                  : tooltipPosition.x > window.innerWidth * 0.5 
                    ? `${tooltipPosition.x - (window.innerWidth > 640 ? 300 : 250)}px` 
                    : `${tooltipPosition.x + 10}px`,
                top: tooltipPosition.y > window.innerHeight * 0.6 ? 'auto' : `${tooltipPosition.y + 10}px`,
                bottom: tooltipPosition.y > window.innerHeight * 0.6 ? `${window.innerHeight - tooltipPosition.y + 10}px` : 'auto',
              }}
            >
              <h3 className="font-extrabold text-sm sm:text-lg text-gray-900 border-b pb-1.5 mb-3">
  {(() => {
    // 1. 타입에 상관없이 ID가 일치하는 지역 찾기
    const feature = geoData.features.find(
      (f: any) => String(f.properties.id) === String(hoveredRegionId)
    );
    if (!feature) return "지역 정보 없음";

    // 2. name 또는 SIG_KOR_NM 등 다양한 속성명 대응
    const regionName = feature.properties.name || feature.properties.SIG_KOR_NM || "";
    
    // 3. 기초단위(local)일 때만 '경기도 수원시' 형태로 표시
    if (mapType === 'local') {
      const sidoId = String(hoveredRegionId).substring(0, 2);
      const sidoName = SIDO_MAP[sidoId] || "";
      return `${sidoName} ${regionName}`;
    }
    
    return regionName;
  })()}
</h3>
             
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

      <div className="bg-white border-t p-2 sm:p-3 flex justify-center gap-3 sm:gap-6 text-[10px] sm:text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-hide">
        {PARTIES.filter(p => p.selectable).map(party => (
          <div key={party.id} className="flex items-center gap-1.5 bg-gray-50 px-2 sm:px-3 py-1 rounded-full border border-gray-100 shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: party.color}} />
            <span className="text-gray-600">{party.abbr}</span>
            <span className="text-blue-600 font-extrabold">{stats[party.id] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KoreanElectionPredictor;