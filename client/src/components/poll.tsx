import React, { useEffect, useState, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  LineChart, Line, Legend
} from 'recharts';
import { Search, Info, Calendar, Users, ArrowLeft, CheckCircle2, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';

interface PollData {
  poll_id: string;
  survey_date: string;
  surveyor: string;
  client: string;
  method: string;
  sample_size: string;
  region: string;
  target: string;
  response_rate: string;
  margin_of_error: string;
  confidence_level: string;
  weighting: string;
  candidate_name: string;
  party: string;
  support_rate: number;
}

interface GroupedPoll {
  metadata: Partial<PollData>;
  candidates: { name: string; party: string; rate: number }[];
}

const PARTY_COLORS: { [key: string]: string } = {
  '더불어민주당': '#004ea2',
  '국민의힘': '#e61e2b',
  '개혁신당': '#EE7B1E',
  '조국혁신당': '#06275E',
  '진보당': '#8000FF',
  '무소속': '#888888',
  '기타': '#94a3b8'
};

// ------------------------------------------------------------------
// 1. 추이 그래프 컴포넌트 (본선 양자/다자 대결 필터링 & 합산 로직)
// ------------------------------------------------------------------
interface RegionTrendChartProps {
  data: PollData[];
  targetRegion: string;
  officialCandidates: string[];
}

const RegionTrendChart: React.FC<RegionTrendChartProps> = ({ data, targetRegion, officialCandidates }) => {
  const { trendData, candidates, partyMap } = useMemo(() => {
    const regionData = data.filter(poll => poll.region === targetRegion);

    const pollCandidatesMap: { [key: string]: Set<string> } = {};
    regionData.forEach(poll => {
      if (!poll.poll_id) return;
      if (!pollCandidatesMap[poll.poll_id]) {
        pollCandidatesMap[poll.poll_id] = new Set();
      }
      pollCandidatesMap[poll.poll_id].add(poll.candidate_name);
    });

    const dataByPoll: { [key: string]: any } = {};
    const candidateSet = new Set<string>();
    const partyMapping: { [key: string]: string } = {};

    regionData.forEach(poll => {
      if (!poll.poll_id) return;

      if (officialCandidates && officialCandidates.length > 0) {
        const hasAllOfficial = officialCandidates.every(cand => 
          pollCandidatesMap[poll.poll_id].has(cand)
        );
        if (!hasAllOfficial) return;
      }

      if (!dataByPoll[poll.poll_id]) {
        dataByPoll[poll.poll_id] = { 
          poll_id: poll.poll_id,
          survey_date: poll.survey_date,
          surveyor: poll.surveyor
        };
      }
      
      const rate = Number(poll.support_rate) || 0;
      const isOfficial = officialCandidates.length === 0 || officialCandidates.includes(poll.candidate_name);

      if (isOfficial) {
        dataByPoll[poll.poll_id][poll.candidate_name] = rate;
        candidateSet.add(poll.candidate_name);
        partyMapping[poll.candidate_name] = poll.party;
      } else {
        const currentOthers = dataByPoll[poll.poll_id]['그 외 후보'] || 0;
        dataByPoll[poll.poll_id]['그 외 후보'] = parseFloat((currentOthers + rate).toFixed(1));
      }
    });

    let hasOthers = false;
    Object.values(dataByPoll).forEach(pollObj => {
      if (pollObj['그 외 후보'] !== undefined) {
        if (pollObj['그 외 후보'] > 0) hasOthers = true;
        else delete pollObj['그 외 후보'];
      }
    });

    if (hasOthers) {
      candidateSet.add('그 외 후보');
      partyMapping['그 외 후보'] = '기타';
    }

    const sortedTrendData = Object.values(dataByPoll).sort((a, b) => 
      (a.survey_date || '').localeCompare(b.survey_date || '')
    );

    const sortedCandidates = Array.from(candidateSet).sort((a, b) => {
      if (a === '그 외 후보') return 1;
      if (b === '그 외 후보') return -1;
      return 0;
    });

    return {
      trendData: sortedTrendData,
      candidates: sortedCandidates,
      partyMap: partyMapping
    };
  }, [data, targetRegion, officialCandidates]);

  if (trendData.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-gray-100 text-gray-500 font-bold mb-8 shadow-sm">
        주요 확정 후보들이 모두 포함된 본선 여론조사 추이 데이터가 아직 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800">
        <TrendingUp className="text-blue-600" />
        {targetRegion} 지지율 추이 (본선 가상대결 기준)
      </h2>
      
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="survey_date" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} tickMargin={10} />
            <YAxis domain={[0, 'auto']} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} tickFormatter={(value) => `${value}%`} />
            
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              labelFormatter={(label, payload) => {
                if (payload && payload.length > 0) {
                  return `${label} (${payload[0].payload.surveyor})`;
                }
                return label;
              }}
              formatter={(value: any) => [`${value}%`]} 
              labelStyle={{ fontWeight: '900', color: '#1e293b', marginBottom: '8px' }}
            />
            
            <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold', fontSize: '13px' }} />

            {candidates.map((candidateName) => {
              const isOther = candidateName === '그 외 후보';
              const party = partyMap[candidateName];
              const color = PARTY_COLORS[party] || '#888888';
              return (
                <Line
                  key={candidateName}
                  type="monotone"
                  dataKey={candidateName}
                  name={isOther ? candidateName : `${candidateName} (${party})`}
                  stroke={color}
                  strokeWidth={isOther ? 3 : 4}
                  strokeDasharray={isOther ? "5 5" : undefined}
                  activeDot={{ r: 7, strokeWidth: 0 }}
                  connectNulls={true}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 2. 개별 차트 카드 컴포넌트
// ------------------------------------------------------------------
const PollCard = React.memo(({ poll, onRegionClick }: { poll: GroupedPoll, onRegionClick: (region: string) => void }) => {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-lg transition-all duration-300 mb-8">
      <div className="p-6 bg-slate-50 border-b border-gray-100">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <button 
              onClick={() => onRegionClick(poll.metadata.region || '')}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-md mb-2 transition-colors shadow-sm"
              title={`${poll.metadata.region} 추이 보기`}
            >
              {poll.metadata.region} 📊
            </button>
            <h2 className="text-xl font-bold leading-tight mb-1">
              {poll.metadata.surveyor} 조사
            </h2>
            <p className="text-xs text-gray-500 font-medium">의뢰: {poll.metadata.client}</p>
          </div>
          <div className="text-right text-gray-500 text-[11px] space-y-1 font-semibold bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-end gap-1.5"><Calendar size={12} className="text-blue-500"/> {poll.metadata.survey_date}</div>
            <div className="flex items-center justify-end gap-1.5"><Users size={12} className="text-blue-500"/> N={poll.metadata.sample_size}</div>
            <div className="flex items-center justify-end gap-1.5"><CheckCircle2 size={12} className="text-blue-500"/> {poll.metadata.method}</div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={poll.candidates} layout="vertical" margin={{ left: 5, right: 45, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fontWeight: 800, fill: '#334155' }} width={70} axisLine={false} tickLine={false} />
            <Tooltip cursor={{fill: '#f8fafc'}} content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-xl text-xs font-bold border border-slate-700">
                    {data.party} | {data.rate}%
                  </div>
                );
              }
              return null;
            }} />
            <Bar dataKey="rate" radius={[0, 8, 8, 0]} barSize={28} animationDuration={500}>
              {poll.candidates.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={PARTY_COLORS[entry.party] || '#cbd5e1'} />
              ))}
              <LabelList dataKey="rate" position="right" offset={10} fill="#1e293b" style={{ fontSize: '12px', fontWeight: '900' }} formatter={(v: any) => `${v}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 복구된 디테일 박스 (표본오차, Info 등) */}
      <div className="px-6 py-4 bg-slate-50/80 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">표본오차</p>
            <p className="text-sm font-black text-blue-600">{poll.metadata.margin_of_error}</p>
            <p className="text-[9px] text-gray-400">({poll.metadata.confidence_level} 신뢰수준)</p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">가중치 부여</p>
            <p className="text-[11px] font-bold text-gray-700 leading-tight">{poll.metadata.weighting}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 text-[10px] text-gray-400 bg-white/50 p-2 rounded-lg border border-dashed border-gray-200">
          <Info size={12} className="mt-0.5 shrink-0" />
          <p className="leading-relaxed">자세한 사항은 중앙선거여론조사심의위원회 참조</p>
        </div>
      </div>
    </div>
  );
});

// ------------------------------------------------------------------
// 3. 메인 Poll 페이지 컴포넌트
// ------------------------------------------------------------------
const Poll: React.FC = () => {
  const [polls, setPolls] = useState<GroupedPoll[]>([]);
  const [rawPolls, setRawPolls] = useState<PollData[]>([]);
  const [officialCandidatesMap, setOfficialCandidatesMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedTrendRegion, setSelectedTrendRegion] = useState<string | null>(null);
  const hotRegions = ["서울특별시", "경기도", "인천광역시", "담양군", "청양군"]; 

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [candResponse, pollResponse] = await Promise.all([
          fetch('/candidates.csv'),
          fetch('/polls.csv')
        ]);

        const candText = await candResponse.text();
        const pollText = await pollResponse.text();

        Papa.parse(candText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            const candMap: Record<string, string[]> = {};
            results.data.forEach((row: any) => {
              const region = row.region_name;
              if (region) {
                const cands: string[] = [];
                Object.keys(row).forEach(key => {
                  if (key.startsWith('cand') && key.endsWith('_name') && row[key]) {
                    cands.push(row[key].toString().trim());
                  }
                });
                candMap[region] = cands;
              }
            });
            setOfficialCandidatesMap(candMap);
          }
        });

        Papa.parse(pollText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rawData = results.data as PollData[];
            setRawPolls(rawData); 

            const grouped = rawData.reduce((acc: { [key: string]: GroupedPoll }, curr) => {
              if (!curr.poll_id) return acc;
              if (!acc[curr.poll_id]) {
                acc[curr.poll_id] = { metadata: { ...curr }, candidates: [] };
              }
              acc[curr.poll_id].candidates.push({
                name: curr.candidate_name,
                party: curr.party,
                rate: Number(curr.support_rate) || 0 
              });
              return acc;
            }, {});
            
            const finalData = Object.values(grouped).map(poll => ({
              ...poll,
              candidates: poll.candidates.sort((a, b) => b.rate - a.rate)
            }));

            setPolls(finalData);
            setLoading(false);
          }
        });
      } catch (error) {
        console.error("데이터 로드 에러:", error);
        setLoading(false);
      }
    };
    
    fetchAllData();
  }, []);

  const filteredPolls = useMemo(() => {
    return polls
      .filter(poll => 
        poll.metadata.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        poll.metadata.surveyor?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => (b.metadata.survey_date || '').localeCompare(a.metadata.survey_date || ''));
  }, [polls, searchTerm]);

  // 존재하는 전체 지역 이름 추출 (드롭다운용)
  const allRegions = Array.from(new Set(rawPolls.map(p => p.region))).filter(Boolean).sort();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 font-sans">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-bold">여론조사 및 후보자 데이터 연동 중...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col font-sans text-gray-900 overflow-hidden">
      <header className="w-full max-w-6xl mx-auto p-4 sm:p-8 shrink-0">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-6 transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
          지도 페이지로 돌아가기
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-black mb-2">차기 선거 여론조사 현황</h1>
            <p className="text-gray-500 text-sm">중앙선거여론조사심의위원회 등록 데이터</p>
          </div>

          {!selectedTrendRegion && ( 
            <div className="relative w-full md:w-80">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder="지역명 또는 조사기관 검색..." 
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-400 outline-none shadow-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 pb-8 flex flex-col">
        <div className="mb-6 p-4 bg-blue-50/70 rounded-2xl border border-blue-100 shrink-0">
          <h2 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
            <TrendingUp size={16} /> 지역별 추이 보기
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {hotRegions.map(region => (
              <button
                key={region}
                onClick={() => setSelectedTrendRegion(region)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                  selectedTrendRegion === region 
                  ? 'bg-blue-600 text-white border-transparent' 
                  : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {region}
              </button>
            ))}
            
            <select
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              value={selectedTrendRegion || ""}
              onChange={(e) => {
                if (e.target.value) setSelectedTrendRegion(e.target.value);
              }}
            >
              <option value="" disabled>➕ 기타 지역 선택...</option>
              {allRegions
                .filter(r => !hotRegions.includes(r))
                .map(region => (
                  <option key={region} value={region}>{region}</option>
                ))
              }
            </select>

            {selectedTrendRegion && (
               <button 
                 onClick={() => setSelectedTrendRegion(null)} 
                 className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-300 ml-auto"
               >
                 목록으로 돌아가기
               </button>
            )}
          </div>
        </div>

        {selectedTrendRegion ? (
          <div className="flex-1 overflow-y-auto pb-8">
            <RegionTrendChart 
              data={rawPolls} 
              targetRegion={selectedTrendRegion} 
              officialCandidates={officialCandidatesMap[selectedTrendRegion] || []} 
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            {filteredPolls.length > 0 ? (
              <Virtuoso
                style={{ height: '100%' }}
                data={filteredPolls}
                totalCount={filteredPolls.length}
                // 경고 방지: 안 쓰는 index 대신 `_` 사용
                itemContent={(_, poll) => ( 
                  <div className="px-1">
                    <PollCard poll={poll} onRegionClick={(region) => setSelectedTrendRegion(region)} />
                  </div>
                )}
                overscan={1000} 
              />
            ) : (
              <div className="py-32 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                <Search size={48} className="mx-auto text-gray-200 mb-4" />
                <p className="text-gray-400 font-bold text-lg">검색 결과가 없습니다.</p>
                <button onClick={() => setSearchTerm('')} className="mt-4 text-blue-500 font-bold hover:underline">초기화</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Poll;