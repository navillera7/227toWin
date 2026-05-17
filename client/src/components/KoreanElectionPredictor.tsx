import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Pane } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 
import { toBlob } from 'html-to-image';
import { Github, Mail, MapPin, TrendingUp } from 'lucide-react';
import Papa from 'papaparse'; // CSV 파싱용
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const SIDO_MAP: { [key: string]: string } = {
  '11': '서울특별시', '26': '부산광역시', '27': '대구광역시', '28': '인천광역시', '30': '대전광역시', '31': '울산광역시', '36': '세종특별자치시',
  '41': '경기도', '51': '강원특별자치도', '43': '충청북도', '44': '충청남도',
  '45': '전북특별자치도', '47': '경상북도', '48': '경상남도', '50': '제주특별자치도', '90': '전남광주통합특별시'
};

const PARTIES = [
  { id: 'undecided', name: '미정', color: '#e0e0e0', selectable: true, abbr: '미정' },
  { id: 'dp', name: '더불어민주당', color: '#0073EF', selectable: true, abbr: '민주' },
  { id: 'ppp', name: '국민의힘', color: '#e61e2b', selectable: true, abbr: '국힘' },
  { id: 'reform', name: '개혁신당', color: '#EE7B1E', selectable: true, abbr: '개혁' },
  { id: 'cho', name: '조국혁신당', color: '#06275E', selectable: true, abbr: '혁신' },
  { id: 'pro', name: '진보당', color: '#8000FF', selectable: true, abbr: '진보' },
  { id: 'mu', name: '무소속', color: '#495057', selectable: true, abbr: '무' },
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

const MapResizer: React.FC<{ isFullscreen: boolean }> = ({ isFullscreen }) => {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const t1 = setTimeout(invalidate, 100);
    const t2 = setTimeout(invalidate, 300);
    const t3 = setTimeout(invalidate, 500);
    
    window.addEventListener('resize', invalidate);

    if (!isFullscreen) {
      // 대시보드 모드 (중앙 컬럼이 좁아지므로 줌 레벨 조정)
      map.setView([36.0, 127.8], 6.3);
    } else {
      // 크게보기 모드
      map.setView([36.0, 127.8], 7.0);
    }

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      window.removeEventListener('resize', invalidate);
    };
  }, [isFullscreen, map]);
  
  return null;
};

const exportMapStyle: React.CSSProperties = {
  position: 'fixed', top: '0', left: '0', width: '1000px', height: '1200px',
  backgroundColor: '#ffffff', zIndex: -9999, pointerEvents: 'none'
};

const KoreanElectionPredictor: React.FC = () => {
  const { token, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [mapType, setMapType] = useState<'metro' | 'local'>('metro');
  const [predictions, setPredictions] = useState<PredictionState>({});
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [metroGeoData, setMetroGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openSidos, setOpenSidos] = useState<string[]>(['11', '41', '28']);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const selectedPartyIdRef = useRef<string | null>(null);
  const [regionStats, setRegionStats] = useState<any[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  
  const tooltipRef = useRef<HTMLDivElement>(null);
  const statsCache = useRef<{ [key: string]: any[] }>({});
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const exportMapRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // 데이터 상태
  const [allRawPolls, setAllRawPolls] = useState<any[]>([]);
  const [polls, setPolls] = useState<{agency: string, date: string, text: string}[]>([]);
  const [currentPollIndex, setCurrentPollIndex] = useState(0);

  const [newsList, setNewsList] = useState<{title: string, link: string, pubDate: string, publisher: string, thumbnail: string}[]>([]);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);

  // 여론조사 전체 원본 데이터 및 위젯 데이터 파싱
  useEffect(() => {
    const fetchAllPolls = async () => {
      try {
        const res = await fetch('/polls.csv');
        if (!res.ok) throw new Error("CSV 파일 없음");
        const csvText = await res.text();
        
        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rawData = results.data as any[];
            setAllRawPolls(rawData); // 좌측 미니 차트를 위해 원본 저장

            // 슬라이드 위젯용 최신 여론조사 파싱 로직
            const parsedPolls: any[] = [];
            const seenPollIds = new Set();
            
            // 최신 조사를 위로 가져오기 위해 역순 탐색
            for (let i = rawData.length - 1; i >= 0; i--) {
              const row = rawData[i];
              if (!row.poll_id) continue;
              
              const candidate = {
                name: row.candidate_name,
                party: (row.party || '').replace('더불어민주당', '민주').replace('국민의힘', '국힘').replace('조국혁신당', '조국혁신').replace('개혁신당', '개혁'),
                rate: Number(row.support_rate) || 0
              };

              if (!seenPollIds.has(row.poll_id)) {
                seenPollIds.add(row.poll_id);
                parsedPolls.push({ 
                  poll_id: row.poll_id, agency: row.surveyor, date: row.survey_date, region: row.region, candidates: [candidate] 
                });
              } else {
                const currentPoll = parsedPolls.find(p => p.poll_id === row.poll_id);
                if (currentPoll) currentPoll.candidates.push(candidate);
              }
            }

            const finalPolls = parsedPolls.map(poll => {
              poll.candidates.sort((a: any, b: any) => b.rate - a.rate); 
              const candText = poll.candidates.slice(0, 3).map((c: any) => `${c.name}(${c.party}) ${c.rate}%`).join(', ');
              return { agency: poll.agency, date: poll.date, text: `[${poll.region}] ${candText}` };
            });

            if (finalPolls.length > 0) setPolls(finalPolls.slice(0, 10));
          }
        });
      } catch (err) {
        console.error("여론조사 로드 실패", err);
      }
    };
    fetchAllPolls();
  }, []);

  useEffect(() => {
    if (polls.length <= 1) return;
    const pollTimer = setInterval(() => setCurrentPollIndex((prev) => (prev + 1) % polls.length), 3500);
    return () => clearInterval(pollTimer);
  }, [polls.length]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const rssUrl = encodeURIComponent('https://news.google.com/rss/search?q=지방선거&hl=ko&gl=KR&ceid=KR:ko');
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
        const data = await res.json();

        if (data.status === 'ok') {
          const parsedNews = data.items.slice(0, 20).map((item: any) => {
            const rawTitle = item.title;
            const lastDashIndex = rawTitle.lastIndexOf(' - ');
            let title = rawTitle;
            let publisher = '뉴스';

            if (lastDashIndex !== -1) {
              title = rawTitle.substring(0, lastDashIndex);
              publisher = rawTitle.substring(lastDashIndex + 3);
            }

            let thumbnail = item.thumbnail || item.enclosure?.link || "";
            if (!thumbnail && item.description) {
              const imgMatch = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
              if (imgMatch) thumbnail = imgMatch[1];
            }

            return { title, publisher, link: item.link, pubDate: item.pubDate.split(' ')[0], thumbnail };
          });
          setNewsList(parsedNews);
        }
      } catch (error) { console.error("뉴스 로딩 실패:", error); }
    };
    fetchNews();
  }, []);

  useEffect(() => {
    if (newsList.length === 0) return;
    const timer = setInterval(() => setCurrentNewsIndex((prev) => (prev + 1) % newsList.length), 4000);
    return () => clearInterval(timer);
  }, [newsList.length]);

  useEffect(() => {
    const fetchSavedData = async () => {
      if (!isAuthenticated || !token || loading) return; 
      try {
        const res = await fetch(`${API_BASE_URL}/api/predict/my`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const savedMap = data[mapType] || {};
          setPredictions(prev => {
            const next = { ...prev };
            Object.keys(savedMap).forEach(id => { if (next[id]) next[id].prediction = savedMap[id]; });
            return next;
          });
        }
      } catch (err) { console.error("데이터 로드 실패:", err); }
    };
    fetchSavedData();
  }, [isAuthenticated, token, mapType, loading]);

  const handleRegionClick = (id: string) => {
    const currentPartyId = selectedPartyIdRef.current;
    if (!currentPartyId) return;
    setPredictions(prev => ({ ...prev, [id]: { ...prev[id], prediction: currentPartyId } }));
  };

  const handleSidoFill = (e: React.MouseEvent, sidoId: string) => {
    e.stopPropagation();
    const currentPartyId = selectedPartyIdRef.current;
    if (!currentPartyId) return; 
    setPredictions(prev => {
      const next = { ...prev };
      const regionsInSido = groupedRegions[sidoId] || [];
      regionsInSido.forEach(region => { next[region.id] = { ...next[region.id], prediction: currentPartyId }; });
      return next;
    });
  };

  useEffect(() => { selectedPartyIdRef.current = selectedPartyId; }, [selectedPartyId]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!hoveredRegionId) { setRegionStats([]); return; }
      const cacheKey = `${mapType}-${hoveredRegionId}`;
      if (statsCache.current[cacheKey]) { setRegionStats(statsCache.current[cacheKey]); return; }

      setIsStatsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/predict/stats/${mapType}/${hoveredRegionId}`);
        if (res.ok) {
          const data = await res.json();
          const sortedData = data.sort((a: any, b: any) => b.count - a.count);
          statsCache.current[cacheKey] = sortedData;
          setRegionStats(sortedData);
        }
      } catch (err) { console.error("통계 로드 실패:", err); } 
      finally { setIsStatsLoading(false); }
    };
    const timer = setTimeout(fetchStats, 300); 
    return () => clearTimeout(timer);
  }, [hoveredRegionId, mapType]);

  const handleShare = async () => {
    if (!exportMapRef.current || isSharing || !geoData) return;
    setIsSharing(true);
    setHoveredRegionId(null); 
    
    try {
      const blob = await toBlob(exportMapRef.current, { backgroundColor: '#ffffff', width: 1000, height: 1200, cacheBust: true, pixelRatio: 2 });
      if (!blob) throw new Error("캡처 데이터가 없습니다.");
        
      const file = new File([blob], '2026-election-diagram.png', { type: 'image/png' });
      const shareData = { title: '2026 지방선거 다이어그램', text: '내가 예측한 2026 지방선거 판세! 여러분도 직접 그려보세요.\nhttps://227towin.com' };
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ ...shareData, files: [file] }); } catch (err) { console.log("공유 취소/실패:", err); }
      } else {
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          alert('📸 다이어그램 이미지가 클립보드에 복사되었습니다!\n\nPC 카카오톡, X 등에 바로 붙여넣기(Ctrl+V) 하세요.');
        } catch (err) { alert('클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.'); }
      }
      setIsSharing(false);
    } catch (error) {
      console.error('캡처 에러:', error);
      alert('다이어그램 생성 중 오류가 발생했습니다.');
      setIsSharing(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("모든 지역의 예측을 초기화하시겠습니까?")) {
      setPredictions(prev => {
        const resetData = { ...prev };
        Object.keys(resetData).forEach(id => { resetData[id] = { ...resetData[id], prediction: 'undecided' }; });
        return resetData;
      });
    }
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) { alert("제출하려면 먼저 로그인해야 합니다."); navigate('/login'); return; }
    const featureIds = geoData?.features.map((f: any) => String(f.properties.id)) || [];
    const currentPredictions: { [key: string]: string } = {};

    for (const id of featureIds) {
      const pred = predictions[id]?.prediction || 'undecided';
      if (pred === 'undecided') { alert("모든 지역의 예측을 완료한 후 제출해주세요."); return; }
      const party = PARTIES.find(p => p.id === pred);
      if (!party || !party.selectable) { alert("유효하지 않은 정당이 선택된 지역이 있습니다."); return; }
      currentPredictions[id] = pred;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/predict/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mapType, predictions: currentPredictions, totalCount: featureIds.length })
      });
      if (res.ok) alert("예측 결과가 성공적으로 저장되었습니다!");
      else alert("저장에 실패했습니다.");
    } catch (err) { alert("서버 통신 오류가 발생했습니다."); }
  };

  const applyPastResult = (year: string) => {
    setPredictions(prev => {
      const nextPredictions = { ...prev };
      Object.keys(nextPredictions).forEach(id => {
        const regionInfo = nextPredictions[id].info;
        if (regionInfo && regionInfo.pastResults) {
          const pastRecord = regionInfo.pastResults.find(r => r.year === year);
          if (pastRecord && pastRecord.party) { nextPredictions[id] = { ...nextPredictions[id], prediction: pastRecord.party }; }
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
          return { year: `'${parts[0].trim()}`, party: parts[1].trim().split(' ')[0], winner: parts[1].trim().split(' ').slice(1).join(' ') };
        }).filter((x): x is any => x !== null) : [];

        if (id) {
          newData[id] = {
            prediction: 'undecided',
            info: {
              cand1: { name: c1n, party: c1p }, cand2: { name: c2n, party: c2p },
              pastResults: [ { year: '2022', winner: p22w, party: p22p }, { year: '2018', winner: p18w, party: p18p }, { year: '2014', winner: p14w, party: p14p } ],
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
    fetch(`/${mapType === 'metro' ? 'metro_updated.json' : 'local_updated.json'}`)
      .then(res => { if (!res.ok) throw new Error("Network response was not ok"); return res.json(); })
      .then(data => { setGeoData(data); setLoading(false); })
      .catch(err => { console.error("지도 로딩 실패:", err); setLoading(false); });
      
    fetch('/metro_updated.json').then(res => res.json()).then(data => setMetroGeoData(data)).catch(err => console.error("광역 경계 로딩 실패:", err));
  }, [mapType]);

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

  const toggleSido = (sidoId: string) => setOpenSidos(prev => prev.includes(sidoId) ? prev.filter(id => id !== sidoId) : [...prev, sidoId]);
  const stats = getStatistics();

  // ✨ 현재 호버링된 지역 이름 구하기
  const hoveredRegionName = useMemo(() => {
    if (!hoveredRegionId || !geoData) return "";
    const feature = geoData.features.find((f: any) => String(f.properties.id) === String(hoveredRegionId));
    if (!feature) return "";
    const name = feature.properties.name || feature.properties.SIG_KOR_NM || "";
    return mapType === 'local' ? `${SIDO_MAP[String(hoveredRegionId).substring(0, 2)] || ""} ${name}` : name;
  }, [hoveredRegionId, geoData, mapType]);

  // ✨ 호버링된 지역의 미니 추세선 데이터 생성 (확정 후보 전용 로직)
  const miniTrendData = useMemo(() => {
    if (!hoveredRegionName || allRawPolls.length === 0) return null;
    
    const regionPolls = allRawPolls.filter(poll => poll.region === hoveredRegionName);
    if (regionPolls.length === 0) return null;

    // 현재 지역의 확정 후보 명단 추출
    const info = predictions[hoveredRegionId || '']?.info;
    const officialCands = [info?.cand1?.name, info?.cand2?.name].filter(Boolean) as string[];

    const pollCandidatesMap: { [key: string]: Set<string> } = {};
    regionPolls.forEach(poll => {
      if (!poll.poll_id) return;
      if (!pollCandidatesMap[poll.poll_id]) pollCandidatesMap[poll.poll_id] = new Set();
      pollCandidatesMap[poll.poll_id].add(poll.candidate_name);
    });

    const dataByPoll: { [key: string]: any } = {};
    const candidateSet = new Set<string>();

    regionPolls.forEach(poll => {
      if (!poll.poll_id) return;
      // 주요 후보가 모두 포함된 조사만 통과
      if (officialCands.length > 0) {
        const hasAllOfficial = officialCands.every(cand => pollCandidatesMap[poll.poll_id].has(cand));
        if (!hasAllOfficial) return;
      }

      if (!dataByPoll[poll.poll_id]) {
        dataByPoll[poll.poll_id] = { poll_id: poll.poll_id, survey_date: poll.survey_date };
      }
      
      const rate = Number(poll.support_rate) || 0;
      const isOfficial = officialCands.length === 0 || officialCands.includes(poll.candidate_name);

      if (isOfficial) {
        dataByPoll[poll.poll_id][poll.candidate_name] = rate;
        candidateSet.add(poll.candidate_name);
      }
    });

    const sortedTrendData = Object.values(dataByPoll).sort((a, b) => (a.survey_date || '').localeCompare(b.survey_date || ''));
    if (sortedTrendData.length === 0) return null;

    return { trendData: sortedTrendData, candidates: Array.from(candidateSet) };
  }, [hoveredRegionName, allRawPolls, predictions, hoveredRegionId]);


  // ✨ 좌측 호버 정보 & 차트 렌더링 영역 (대시보드 모드일 때만 표시)
  const renderHoverInfoPanel = () => {
    if (!hoveredRegionId) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <MapPin size={48} className="mb-4 text-gray-200" />
          <p className="font-bold text-lg text-gray-500">지역 상세 정보</p>
          <p className="text-sm mt-2">지도에서 지역 위에 마우스를 올려보세요.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full animate-fade-in">
        <h3 className="font-extrabold text-2xl text-gray-900 mb-6 border-b pb-4">
          {hoveredRegionName}
        </h3>

        {/* 유저 실시간 예측 바 */}
        <div className="mb-8">
          <p className="text-xs font-extrabold text-blue-600 mb-3 uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
            유저 예측 현황
          </p>
          {isStatsLoading ? (
             <div className="space-y-3 py-2"><div className="h-4 bg-gray-100 animate-pulse rounded-full w-full"></div></div>
          ) : regionStats.length > 0 ? (
            <div className="space-y-3">
              {regionStats.map((s: any) => {
                const party = PARTIES.find(p => p.id === s._id);
                const total = regionStats.reduce((acc, cur) => acc + cur.count, 0);
                const percentage = Math.round((s.count / total) * 100);
                return (
                  <div key={s._id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-gray-700">{party?.name || '기타'}</span>
                      <span className="text-gray-500">{percentage}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full transition-all duration-700" style={{ width: `${percentage}%`, backgroundColor: party?.color || '#cbd5e1' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center">아직 예측 데이터가 없습니다.</p>
          )}
        </div>

        {/* 주요 후보 및 과거 기록 */}
        {predictions[hoveredRegionId]?.info && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {[predictions[hoveredRegionId].info?.cand1, predictions[hoveredRegionId].info?.cand2].map((c, i) => (
                <div key={i} className="flex flex-col items-center bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm">
                  <span className="text-xs font-bold text-white px-2 py-1 rounded-md mb-2" style={{backgroundColor: PARTIES.find(p => p.id === c?.party)?.color}}>
                    {PARTIES.find(p => p.id === c?.party)?.abbr}
                  </span>
                  <span className="text-lg font-black text-gray-800">{c?.name}</span>
                </div>
              ))}
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <p className="text-xs uppercase text-gray-400 font-bold mb-3">과거 당선 기록</p>
              <div className="space-y-2">
                {predictions[hoveredRegionId].info?.pastResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-400 font-medium">{r.year}</span>
                    <span className="font-bold text-gray-700">{r.winner}</span>
                    <span className="px-2 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: PARTIES.find(p => p.id === r.party)?.color }}>
                      {PARTIES.find(p => p.id === r.party)?.abbr || '?'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 미니 여론조사 추이 차트 */}
        {miniTrendData && (
          <div className="mt-8">
            <p className="text-xs font-extrabold text-gray-800 mb-4 flex items-center gap-1.5 border-t pt-6">
              <TrendingUp size={14} className="text-blue-500"/> 본선 여론조사 추이
            </p>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={miniTrendData.trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="survey_date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickMargin={8} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={(val) => `${val}%`} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                    formatter={(val: any) => [`${val}%`]} 
                  />
                  {miniTrendData.candidates.map((cand) => {
                    // cand 이름과 정확히 일치하는 파티 색상 찾기 로직 보강
                    const partyInfo = PARTIES.find(p => 
                      p.id === (predictions[hoveredRegionId || '']?.info?.cand1?.name === cand 
                        ? predictions[hoveredRegionId || '']?.info?.cand1?.party 
                        : predictions[hoveredRegionId || '']?.info?.cand2?.party)
                    );
                    const color = partyInfo?.color || '#888888';
                    return <Line key={cand} type="monotone" dataKey={cand} name={cand} stroke={color} strokeWidth={3} dot={{r: 3}} activeDot={{r: 5, strokeWidth:0}} connectNulls />;
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    );
  };


  return (
    <div className={`min-h-screen bg-[#F8F9FA] flex flex-col font-sans ${selectedPartyId ? 'cursor-crosshair' : ''}`}>
      
      {!isFullscreen && (
        <header className="h-16 sm:h-20 bg-white flex items-center justify-between px-4 sm:px-8 border-b border-gray-200 z-[3000] shadow-sm">
          <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tighter">227toWin</h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="https://www.buymeacoffee.com/227towin" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#FFDD00] text-black rounded-lg font-bold text-[11px] sm:text-sm shadow-sm hover:bg-[#FFEA4C] transition-all hover:-translate-y-0.5">
              ☕ <span className="hidden sm:inline">커피 후원</span><span className="sm:hidden">후원</span>
            </a>
            <button onClick={handleShare} disabled={isSharing} className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-800 text-white rounded-lg font-bold text-[11px] sm:text-sm shadow-md hover:bg-gray-950 transition-all disabled:opacity-70">
              📸 <span className="hidden sm:inline">예측 공유</span><span className="sm:hidden">공유</span>
            </button>
            {isAuthenticated ? (
              <button onClick={logout} className="px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 text-gray-700 rounded-lg font-bold text-[11px] sm:text-sm hover:bg-gray-50 transition-colors">로그아웃</button>
            ) : (
              <Link to="/login" className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-50 text-blue-600 rounded-lg font-bold text-[11px] sm:text-sm hover:bg-blue-100 transition-colors">로그인</Link>
            )}
          </div>
        </header>
      )}

      {/* 내보내기용 숨겨진 지도 */}
      <div ref={exportMapRef} style={exportMapStyle}>
        <div style={{ position: 'absolute', bottom: '30px', right: '30px', zIndex: 1000, padding: '12px 20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: '900', color: '#1F2937', letterSpacing: '-0.5px' }}>2026 지방선거 예측</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#2563EB' }}>227towin.com</span>
        </div>
        {geoData && (
          <MapContainer center={[35.8, 127.8]} zoom={7.6} zoomSnap={0.1} style={{width: '100%', height: '100%'}} zoomControl={false} dragging={false} doubleClickZoom={false} scrollWheelZoom={false} attributionControl={false} preferCanvas={true}>
            <GeoJSON 
              key={`export-${mapType}-${geoData?.features?.length || 0}`}
              data={geoData} 
              style={(f: any) => ({
                fillColor: PARTIES.find(p => p.id === (predictions[f.properties.id]?.prediction || 'undecided'))?.color || '#e0e0e0',
                weight: 0.8, opacity: 1, color: '#4B5563', fillOpacity: 0.9
              })}
            />
            {metroGeoData && (
              <Pane name="export-metro-borders" style={{ zIndex: 500, pointerEvents: 'none' }}>
                <GeoJSON data={metroGeoData} style={() => ({ fillColor: 'transparent', color: '#1e293b', weight: 3, opacity: 0.9, fillOpacity: 0 })} interactive={false} />
              </Pane>
            )}
          </MapContainer>
        )}
      </div>

      {/* ✨ 3단 레이아웃 핵심 적용부 */}
      <div className={isFullscreen 
        ? "fixed inset-0 z-[9999] bg-white flex flex-col" 
        : "flex-1 w-full max-w-[1700px] mx-auto p-4 lg:p-6 flex flex-col lg:flex-row gap-6 h-[calc(100vh-80px)]"
      }>

        {/* ✨ [좌측 1단] 지역 상세정보 호버 위젯 (대시보드 모드 전용) */}
        {!isFullscreen && (
          <div className="hidden lg:flex flex-col w-full lg:w-[30%] bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 overflow-y-auto order-2 lg:order-1 h-full">
            {renderHoverInfoPanel()}
          </div>
        )}

        {/* ✨ [중앙 2단] 메인 지도 영역 (폭을 좁혀 한반도 비율에 최적화) */}
        <div className={isFullscreen 
          ? "flex-1 flex flex-col w-full h-full" 
          : "w-full lg:w-[40%] flex flex-col h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] relative overflow-hidden border border-gray-100 order-1 lg:order-2"
        }>
          
          {/* 지도 상단 컨트롤 바 */}
          <div className={`flex justify-between items-center bg-white z-[2000] border-b border-gray-100 flex-shrink-0 ${isFullscreen ? 'p-3 shadow-sm' : 'p-3'}`}>
            <div className="flex gap-1.5 bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setMapType('metro')} className={`px-3 py-1.5 rounded-md font-bold text-xs transition-all ${mapType === 'metro' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>광역단위</button>
              <button onClick={() => setMapType('local')} className={`px-3 py-1.5 rounded-md font-bold text-xs transition-all ${mapType === 'local' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>기초단위</button>
            </div>
            
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)} 
              className="bg-gray-900 text-white px-3 sm:px-4 py-1.5 rounded-lg shadow font-bold text-xs sm:text-sm hover:bg-gray-800 transition-colors flex items-center gap-1"
            >
              {isFullscreen ? '↙ 축소하기' : '🔍 크게보기'}
            </button>
          </div>

          <div className="flex justify-center gap-2 items-center py-2 bg-gray-50/50 border-b border-gray-100 flex-shrink-0 z-[1000]">
            <span className="text-[11px] font-bold text-gray-400 mr-1">과거 기록 불러오기:</span>
            {['2022', '2018', '2014'].map(year => (
              <button key={year} onClick={() => applyPastResult(year)} className="px-3 py-1 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-500 rounded text-[11px] font-bold transition-colors shadow-sm">{year}년</button>
            ))}
          </div>

          <div className="flex-1 flex flex-row overflow-hidden relative min-h-[300px]">
            {/* 좌측 지역 리스트 사이드바 (전체화면에서만 노출) */}
            <div className={`${isFullscreen ? 'hidden sm:flex' : 'hidden'} w-72 md:w-80 bg-white border-r flex-col z-10 shadow-inner flex-shrink-0`}>
              <div className="p-4 border-b bg-gray-50/50 flex-shrink-0">
                <input type="text" placeholder="지역 검색..." className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex-1 overflow-y-auto">
                {Object.keys(groupedRegions).sort().map(groupKey => (
                  <div key={groupKey} className="border-b border-gray-100">
                    {mapType === 'local' && (
                      <div onClick={() => toggleSido(groupKey)} className="flex items-center justify-between px-4 py-3 bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors">
                        <div className="flex items-center">
                          <span className="text-sm font-bold text-gray-700">{SIDO_MAP[groupKey] || '기타'} <span className="ml-2 text-[10px] text-blue-500 font-normal">{groupedRegions[groupKey].length}</span></span>
                          <button onClick={(e) => handleSidoFill(e, groupKey)} className="ml-3 px-2 py-1 bg-white border border-gray-200 rounded-md text-[10px] font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-sm">일괄 색칠</button>
                        </div>
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
                              onMouseEnter={() => setHoveredRegionId(region.id)} 
                              onMouseLeave={() => setHoveredRegionId(null)}
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

            {/* 실제 지도 컨테이너 */}
            <div className="flex-1 relative bg-blue-50/20 w-full h-full min-h-[400px]">
              <MapContainer center={[36.0, 127.8]} zoom={6.3} zoomSnap={0.1} className="absolute inset-0 z-0" style={{ width: '100%', height: '100%' }} zoomControl={false}>
                <MapResizer isFullscreen={isFullscreen} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <ZoomControl />
                {!loading && geoData && (
                  <GeoJSON 
                    key={`${mapType}-${geoData?.features?.length || 0}`} 
                    data={geoData} 
                    style={(f) => ({
                      fillColor: PARTIES.find(p => p.id === (predictions[f?.properties.id]?.prediction || 'undecided'))?.color,
                      weight: 1, color: hoveredRegionId === f?.properties.id ? '#000' : '#888', fillOpacity: hoveredRegionId === f?.properties.id ? 1.0 : 0.9
                    })}
                    onEachFeature={(feature, layer) => {
                      layer.on({
                        click: (e) => { L.DomEvent.stopPropagation(e); handleRegionClick(feature.properties.id); },
                        mouseover: (e) => { 
                          setHoveredRegionId(feature.properties.id); 
                          setTimeout(() => {
                            // 전체화면일 때만 마우스 커서 옆 툴팁 조작
                            if (isFullscreen && tooltipRef.current && window.innerWidth >= 640) { 
                              const x = e.originalEvent.clientX; const y = e.originalEvent.clientY;
                              tooltipRef.current.style.left = x > window.innerWidth * 0.5 ? `${x - 300}px` : `${x + 10}px`;
                              tooltipRef.current.style.top = y > window.innerHeight * 0.6 ? 'auto' : `${y + 10}px`;
                              tooltipRef.current.style.bottom = y > window.innerHeight * 0.6 ? `${window.innerHeight - y + 10}px` : 'auto';
                            }
                          }, 0);
                        },
                        mouseout: () => setHoveredRegionId(null),
                        mousemove: (e) => {
                          if (isFullscreen && tooltipRef.current && window.innerWidth >= 640) {
                            const x = e.originalEvent.clientX; const y = e.originalEvent.clientY;
                            tooltipRef.current.style.left = x > window.innerWidth * 0.5 ? `${x - 300}px` : `${x + 10}px`;
                            tooltipRef.current.style.top = y > window.innerHeight * 0.6 ? 'auto' : `${y + 10}px`;
                            tooltipRef.current.style.bottom = y > window.innerHeight * 0.6 ? `${window.innerHeight - y + 10}px` : 'auto';
                          }
                        }
                      });
                    }} 
                  />
                )}
                {metroGeoData && (
                  <Pane name="metro-borders" style={{ zIndex: 500, pointerEvents: 'none' }}>
                    <GeoJSON data={metroGeoData} style={() => ({ fillColor: 'transparent', color: '#1e293b', weight: 2.5, opacity: 0.8, fillOpacity: 0 })} interactive={false} />
                  </Pane>
                )}
              </MapContainer>

              {loading && (
                <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-white/50 backdrop-blur-sm">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mr-3"></div>
                  <span className="font-bold text-blue-600">지도 데이터 분석 중...</span>
                </div>
              )}

              {/* ✨ [수정] 팝업 툴팁은 이제 전체화면(isFullscreen) 일 때만 표시됩니다! */}
              {hoveredRegionId && isFullscreen && (
                <div 
                  ref={tooltipRef}
                  className="fixed bg-white/95 backdrop-blur-sm p-4 rounded-t-3xl sm:rounded-xl shadow-2xl border border-gray-200 z-[4000] w-full sm:w-72 pointer-events-none transition-none"
                  style={window.innerWidth >= 640 ? { left: '-9999px', top: '-9999px' } : { bottom: '0px', left: '0px' }}
                >
                  <h3 className="font-extrabold text-lg text-gray-900 border-b pb-1.5 mb-3">{hoveredRegionName}</h3>
                  {/* ... (이전의 툴팁 내용 - 유저 예측 및 주요 후보 정보 간략화 표시) ... */}
                  {predictions[hoveredRegionId]?.info ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">주요 후보자</p>
                        <div className="space-y-1.5">
                          {[predictions[hoveredRegionId].info?.cand1, predictions[hoveredRegionId].info?.cand2].map((c, i) => (
                            <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-md border border-gray-100">
                              <span className="text-sm font-bold text-gray-700">{c?.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full text-white font-bold" style={{backgroundColor: PARTIES.find(p => p.id === c?.party)?.color}}>
                                {PARTIES.find(p => p.id === c?.party)?.abbr}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : ( <p className="text-xs text-gray-400 italic">데이터가 없습니다.</p> )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border-t p-2 sm:p-3 flex flex-col sm:flex-row items-center justify-between px-2 sm:px-6 gap-3 flex-shrink-0 z-20">
            <div className="flex gap-2 sm:gap-4 text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-hide w-full sm:flex-1 justify-start pb-1 sm:pb-0 px-1">
              {PARTIES.filter(p => p.selectable).map(party => (
                <div 
                  key={party.id} onClick={() => setSelectedPartyId(prev => prev === party.id ? null : party.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-1.5 rounded-full border cursor-pointer transition-all shadow-sm flex-shrink-0 ${selectedPartyId === party.id ? 'bg-white border-blue-500 ring-2 ring-blue-100 scale-105 shadow-md' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: party.color}} />
                  <span className="text-gray-600">{party.abbr}</span>
                  <span className="text-blue-600 font-extrabold">{stats[party.id] || 0}</span>
                </div>
              ))}
            </div>
            <div className="flex w-full sm:w-auto justify-end">
              <button onClick={handleReset} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 flex-1 sm:flex-none">초기화</button>
              <button onClick={handleSubmit} className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 flex-1 sm:flex-none">{isAuthenticated ? "저장" : "로그인"}</button>
            </div>
          </div>
        </div>

        {/* ✨ [우측 3단] 기존 슬라이드 위젯들 (대시보드 모드 전용) */}
        {!isFullscreen && (
          <div className="w-full lg:w-[30%] flex flex-col gap-6 overflow-y-auto order-3">
            <div className="bg-[#2B2B2B] rounded-3xl p-6 shadow-lg flex flex-col h-[280px] relative overflow-hidden group border border-gray-800">
              <div className="flex justify-between items-center mb-6 z-10">
                <h2 className="text-white text-xl font-bold">최근 여론조사</h2>
                <Link to="/poll" className="text-blue-400 hover:text-blue-300 text-sm font-bold flex items-center transition-colors">전체보기 →</Link>
              </div>
              <div className="flex-1 relative z-10">
                {polls.map((poll, idx) => (
                  <div key={idx} className={`absolute inset-0 transition-opacity duration-700 ${idx === currentPollIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="inline-block bg-white/10 text-gray-300 text-xs px-2.5 py-1 rounded-md mb-3 font-medium border border-gray-700">{poll.agency} · {poll.date}</div>
                    <p className="text-white text-lg sm:text-xl leading-snug font-medium break-keep">{poll.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-center z-10 mt-auto pt-4">
                {polls.map((_, idx) => ( <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === currentPollIndex ? 'bg-blue-400 w-5' : 'bg-gray-600'}`} /> ))}
              </div>
              <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
            </div>

           <div className="bg-[#2B2B2B] rounded-3xl p-6 shadow-lg flex-1 min-h-[320px] flex flex-col relative overflow-hidden border border-gray-800">
              <div className="flex justify-between items-center mb-6 z-10">
                <h2 className="text-white text-xl font-bold">최근 뉴스</h2>
                <span className="text-gray-500 text-xs font-bold">{currentNewsIndex + 1} / {newsList.length}</span>
              </div>
              <div className="flex-1 relative z-10">
                {newsList.length > 0 ? newsList.map((news, idx) => (
                  <div key={idx} className={`absolute inset-0 transition-all duration-700 ease-in-out ${idx === currentNewsIndex ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'}`}>
                    <a href={news.link} target="_blank" rel="noopener noreferrer" className="flex flex-col h-full">
                      <div className="w-full h-32 rounded-2xl mb-4 overflow-hidden bg-gray-800 border border-gray-700 shadow-inner flex-shrink-0">
                        {news.thumbnail ? ( <img src={news.thumbnail} alt="news" className="w-full h-full object-cover" /> ) : (
                          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${['from-blue-800 to-indigo-900', 'from-emerald-800 to-teal-900', 'from-slate-700 to-gray-900', 'from-rose-900 to-red-900', 'from-cyan-800 to-blue-900'][news.title.length % 5]}`}>
                            <span className="text-4xl opacity-40 mix-blend-overlay">{['🏛️', '📊', '🗳️', '🇰🇷', '📰'][news.title.length % 5]}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-[10px] font-bold border border-blue-900/50">{news.publisher}</span>
                        <span className="text-gray-500 text-[10px] font-bold">{news.pubDate}</span>
                      </div>
                      <p className="text-gray-100 text-base sm:text-lg leading-snug font-bold line-clamp-2 break-keep group-hover:text-blue-400 transition-colors">{news.title}</p>
                    </a>
                  </div>
                )) : ( <div className="flex items-center justify-center h-full text-gray-500 text-sm">뉴스를 분석하고 있습니다...</div> )}
              </div>
              <div className="w-full h-1 bg-gray-800 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${((currentNewsIndex + 1) / newsList.length) * 100}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 모바일 검색 관련 UI (기존 동일) */}
      <button onClick={() => setIsMobileSearchOpen(true)} className="sm:hidden fixed bottom-32 right-4 z-[2000] w-14 h-14 bg-blue-600 text-white rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.3)] flex items-center justify-center text-xl active:scale-95 transition-transform">🔍</button>
      {isMobileSearchOpen && (
        <div className="sm:hidden fixed inset-0 z-[5000] bg-white flex flex-col animate-fade-in">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 shadow-sm">
            <input type="text" placeholder="검색할 지역을 입력하세요..." className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <button onClick={() => setIsMobileSearchOpen(false)} className="ml-3 px-3 py-2 text-gray-600 font-bold hover:text-gray-900">닫기</button>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {Object.keys(groupedRegions).sort().map(groupKey => (
              <div key={groupKey} className="border-b border-gray-200 bg-white mb-2 shadow-sm">
                {mapType === 'local' && (
                  <div onClick={() => toggleSido(groupKey)} className="flex items-center justify-between px-5 py-4 cursor-pointer active:bg-gray-100">
                    <div className="flex items-center">
                      <span className="text-base font-bold text-gray-800">{SIDO_MAP[groupKey] || '기타'} <span className="ml-2 text-xs text-blue-500">{groupedRegions[groupKey].length}</span></span>
                      <button onClick={(e) => handleSidoFill(e, groupKey)} className="ml-3 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors shadow-sm">일괄 색칠</button>
                    </div>
                    <span className="text-gray-400 text-xs">{openSidos.includes(groupKey) ? '▲ 접기' : '▼ 펴기'}</span>
                  </div>
                )}
                {(mapType === 'metro' || openSidos.includes(groupKey)) && (
                  <div className="bg-white border-t border-gray-100">
                    {groupedRegions[groupKey].map((region) => {
                      const party = PARTIES.find(p => p.id === (predictions[region.id]?.prediction || 'undecided'));
                      return (
                        <div key={region.id} onClick={() => { handleRegionClick(region.id); setIsMobileSearchOpen(false); }} className="flex items-center justify-between px-6 py-3.5 border-b border-gray-50 active:bg-blue-50">
                          <span className="text-sm font-bold text-gray-700">{region.name}</span>
                          <span className="text-[10px] px-3 py-1 rounded-full text-white font-extrabold shadow-sm" style={{ backgroundColor: party?.color }}>{party?.abbr}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 푸터 영역 */}
      <footer className="mt-16 pt-8 border-t border-gray-200 text-gray-600 bg-transparent pb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 px-4 max-w-[1700px] mx-auto w-full">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h3 className="font-black text-xl text-gray-800 tracking-tight">227toWin</h3>
            <p className="text-sm font-medium mt-1 text-gray-500">Interactive Election Data & Geospatial Visualization</p>
            <p className="text-sm text-gray-400 mt-1">Created by dorudomu</p>
            <p className="text-sm text-gray-400 mt-1">Special Thanks to PikiBye & Mede & Rheinland and my bro</p>
            <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full shadow-sm">
              <MapPin size={12} className="text-blue-500" />
              <span>Ottawa, ON, Canada</span>

            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="mailto:neverland.gfriend2015@gmail.com" className="p-2.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-full transition-all shadow-sm text-gray-600 hover:text-blue-600" title="Email"><Mail size={18} /></a>
          </div>
        </div>
        <div className="text-center text-[11px] font-bold mt-8 text-gray-400 uppercase tracking-widest">© 2026 227toWin. All rights reserved.</div>
      </footer>
    </div>
  );
};

export default KoreanElectionPredictor;