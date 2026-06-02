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
  '기타': '#aaaaaa',
  '없음': '#dddddd',
  '그 외 후보': '#cccccc'
};

// 💡 1D 칼만 필터 평활화 함수 (추세선 계산)
const applyKalmanSmoothing = (chartData: any[], Q = 0.05, R = 4.0) => {
  const state: Record<string, { x: number, p: number }> = {};

  return chartData.map(point => {
    const newPoint = { ...point };
    
    // 객체에서 정당 지지율 데이터만 추출
    const candidates = Object.keys(point).filter(key => 
      typeof point[key] === 'number' && key !== 'poll_id' && key !== 'survey_date'
    );

    for (const cand of candidates) {
      const measurement = point[cand];

      if (!state[cand]) {
        state[cand] = { x: measurement, p: 1.0 };
        newPoint[`${cand}_trend`] = measurement;
      } else {
        let x_pred = state[cand].x;
        let p_pred = state[cand].p + Q;

        let K = p_pred / (p_pred + R);
        state[cand].x = x_pred + K * (measurement - x_pred);
        state[cand].p = (1 - K) * p_pred;

        newPoint[`${cand}_trend`] = Number(state[cand].x.toFixed(1));
      }
    }
    return newPoint;
  });
};

// ------------------------------------------------------------------
// 1. 추이 그래프 컴포넌트 (칼만 필터 및 다자대결 필터링)
// ------------------------------------------------------------------
const RegionTrendChart: React.FC<{ data: PollData[], targetRegion: string, officialCandidates: string[] }> = ({ data, targetRegion, officialCandidates }) => {
  const { trendData, candidates, partyMap } = useMemo(() => {
    const regionData = data.filter(poll => poll.region === targetRegion);

    // 각 여론조사(poll_id)별 출마 후보 맵핑
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

      // 💡 [필터링 1] 지정된 공식 후보들이 모두 포함된 여론조사만 통과
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
      
      // 💡 [필터링 2] 불필요한 항목 제거
      const isMeaningless = poll.candidate_name === '없음' || poll.candidate_name === '기타' || poll.candidate_name === '모름/무응답' || poll.candidate_name === '잘 모름';
      
      // 💡 [필터링 3] 공식 후보만 메인 선으로, 나머지는 '그 외 후보'로 합산
      const isOfficial = officialCandidates.length === 0 || officialCandidates.includes(poll.candidate_name);

      if (!isMeaningless) {
        if (isOfficial) {
          dataByPoll[poll.poll_id][poll.candidate_name] = rate;
          candidateSet.add(poll.candidate_name);
          partyMapping[poll.candidate_name] = poll.party;
        } else {
          const currentOthers = dataByPoll[poll.poll_id]['그 외 후보'] || 0;
          dataByPoll[poll.poll_id]['그 외 후보'] = currentOthers + rate;
          candidateSet.add('그 외 후보');
          partyMapping['그 외 후보'] = '무소속'; 
        }
      }
    });

    // 날짜순 정렬
    const sortedTrendData = Object.values(dataByPoll).sort((a, b) => 
      (a.survey_date || '').localeCompare(b.survey_date || '')
    );

    const sortedCandidates = Array.from(candidateSet).sort((a, b) => {
      if (a === '그 외 후보') return 1;
      if (b === '그 외 후보') return -1;
      return 0;
    });

    // 💡 정렬된 데이터에 칼만 필터 추세선 적용
    const smoothedTrendData = applyKalmanSmoothing(sortedTrendData, 0.05, 4.0);

    return {
      trendData: smoothedTrendData,
      candidates: sortedCandidates,
      partyMap: partyMapping
    };
  }, [data, targetRegion, officialCandidates]);

  if (!trendData || trendData.length === 0) return (
    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-xl border border-gray-200">
      <p className="text-gray-500 font-medium">해당 지역의 추이 데이터가 충분하지 않습니다.</p>
    </div>
  );

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
      <h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
        <TrendingUp size={20} className="text-blue-500" />
        {targetRegion} 지지율 추이 (추세선)
      </h3>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis 
              dataKey="survey_date" 
              tickFormatter={(val) => val ? val.substring(5) : ''}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickMargin={10}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(val) => `${val}%`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />

            {candidates.map((candidateName) => {
              const isOther = candidateName === '그 외 후보';
              const party = partyMap[candidateName];
              const color = PARTY_COLORS[party] || '#888888';
              
              return (
                <React.Fragment key={candidateName}>
                  {/* 실제 조사 점 (투명도 부여) */}
                  <Line
                    type="linear"
                    dataKey={candidateName}
                    stroke={color}
                    strokeWidth={0}
                    opacity={0.25}
                    dot={{ r: 3, fill: color, opacity: 0.5 }}
                  />
                  {/* 칼만 필터 추세선 (굵은 곡선) */}
                  <Line
                    type="monotone"
                    dataKey={`${candidateName}_trend`}
                    name={isOther ? candidateName : `${candidateName} (${party})`}
                    stroke={color}
                    strokeWidth={isOther ? 2 : 4}
                    strokeDasharray={isOther ? "5 5" : undefined}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    connectNulls={true}
                  />
                </React.Fragment>
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-400 mt-4 text-right">* 실선은 개별 여론조사의 노이즈를 제거한 칼만 필터 추세선입니다.</p>
    </div>
  );
};

// ------------------------------------------------------------------
// 2. 여론조사 개별 카드 컴포넌트
// ------------------------------------------------------------------
const PollCard: React.FC<{ poll: GroupedPoll, onRegionClick: (region: string) => void }> = ({ poll, onRegionClick }) => {
  const meta = poll.metadata;
  
  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 mb-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span 
              onClick={() => meta.region && onRegionClick(meta.region)}
              className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full cursor-pointer hover:bg-blue-100 transition-colors"
            >
              {meta.region}
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">
              {meta.survey_date}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 leading-tight">
            {meta.surveyor} <span className="text-gray-400 font-medium text-base">({meta.client})</span>
          </h3>
        </div>
      </div>

      <div className="mb-6 h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={poll.candidates} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={100} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#4b5563', fontSize: 13, fontWeight: 600 }} 
            />
            <Tooltip 
              cursor={{ fill: '#f9fafb' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={24}>
              {poll.candidates.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={PARTY_COLORS[entry.party] || '#d1d5db'} />
              ))}
              <LabelList 
                dataKey="rate" 
                position="right" 
                formatter={(val: any) => `${val}%`}
                style={{ fill: '#374151', fontWeight: 'bold', fontSize: 13 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-500 bg-gray-50 p-4 rounded-2xl">
        <div className="flex items-center gap-1.5"><Users size={14} className="text-gray-400" /><span>표본:</span> <strong className="text-gray-700">{meta.sample_size}</strong></div>
        <div className="flex items-center gap-1.5"><Info size={14} className="text-gray-400" /><span>응답률:</span> <strong className="text-gray-700">{meta.response_rate}</strong></div>
        <div className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-gray-400" /><span>오차:</span> <strong className="text-gray-700">{meta.margin_of_error}</strong></div>
        <div className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-400" /><span>조사:</span> <strong className="text-gray-700 truncate" title={meta.method}>{meta.method}</strong></div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 3. 메인 Poll 페이지 컴포넌트
// ------------------------------------------------------------------
const Poll: React.FC = () => {
  const [polls, setPolls] = useState<GroupedPoll[]>([]);
  const [rawPolls, setRawPolls] = useState<PollData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrendRegion, setSelectedTrendRegion] = useState<string | null>(null);
  const [officialCandidatesMap, setOfficialCandidatesMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [candResponse, pollResponse] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}candidates.csv`),
          fetch(`${import.meta.env.BASE_URL}polls.csv`)
        ]);

        let candText = await candResponse.text();
        let pollText = await pollResponse.text();

        // 💡 BOM 문자 제거
        if (candText.charCodeAt(0) === 0xFEFF) candText = candText.slice(1);
        if (pollText.charCodeAt(0) === 0xFEFF) pollText = pollText.slice(1);

        // 💡 1. candidates.csv 동적 파싱 (cand1_name, cand2_name 등 추출)
        Papa.parse(candText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const map: Record<string, string[]> = {};
            
            results.data.forEach((row: any) => {
              const region = row.region_name?.trim();
              if (!region) return;

              const cands: string[] = [];
              // cand1_name ~ cand10_name 까지 유동적으로 탐색
              for (let i = 1; i <= 10; i++) {
                const candName = row[`cand${i}_name`]?.trim();
                if (candName) cands.push(candName);
              }

              if (cands.length > 0) {
                map[region] = cands;
              }
            });
            
            console.log("✅ 공식 후보 맵핑 완료:", map);
            setOfficialCandidatesMap(map);
          }
        });

        // 💡 2. polls.csv 파싱 및 그룹화
        Papa.parse(pollText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            // id 컬럼과 poll_id 컬럼의 불일치 완벽 대응
            const data = results.data.map((r: any) => ({
              ...r,
              poll_id: r.poll_id || r.id
            })) as PollData[];
            console.log("First row keys:", Object.keys(results.data[0] || {}));
console.log("First row poll_id:", data[0]?.poll_id);
console.log("Total rows:", data.length);
            
            setRawPolls(data);

            const grouped = data.reduce((acc, curr) => {
              if (!curr.poll_id) return acc;
              
              if (!acc[curr.poll_id]) {
                acc[curr.poll_id] = {
                  metadata: {
                    poll_id: curr.poll_id,
                    survey_date: curr.survey_date,
                    surveyor: curr.surveyor,
                    client: curr.client,
                    method: curr.method,
                    sample_size: curr.sample_size,
                    region: curr.region,
                    target: curr.target,
                    response_rate: curr.response_rate,
                    margin_of_error: curr.margin_of_error,
                    confidence_level: curr.confidence_level,
                    weighting: curr.weighting
                  },
                  candidates: []
                };
              }
              
              acc[curr.poll_id].candidates.push({
                name: curr.candidate_name,
                party: curr.party,
                rate: Number(curr.support_rate) || 0
              });
              
              return acc;
            }, {} as Record<string, GroupedPoll>);

            // 지지율(rate) 기준으로 각 조사의 후보자 정렬
            const groupedArray = Object.values(grouped).map(poll => ({
              ...poll,
              candidates: poll.candidates.sort((a, b) => b.rate - a.rate)
            }));

            // 최신 날짜순 정렬
            groupedArray.sort((a, b) => {
              return (b.metadata.survey_date || '').localeCompare(a.metadata.survey_date || '');
            });

            setPolls(groupedArray);
          }
        });
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      }
    };

    fetchData();
  }, []);

  const filteredPolls = useMemo(() => {
    return polls.filter(poll => 
      poll.metadata.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      poll.metadata.surveyor?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [polls, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-pretendard">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4 sm:px-8">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-black tracking-tight text-gray-800">
              여론조사 종합분석 <span className="text-blue-600">추이</span>
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-[1000px] mx-auto w-full p-4 sm:p-8 flex flex-col">
        <div className="mb-8 space-y-4">
          <div className="relative w-full shadow-sm rounded-2xl overflow-hidden bg-white border border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-4 sm:text-lg text-gray-900 bg-transparent outline-none font-medium placeholder:font-normal placeholder:text-gray-400"
              placeholder="지역명(예: 서울특별시) 또는 조사기관 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setSelectedTrendRegion(null)} 
            />
          </div>

          <div className="flex items-center gap-2">
            {selectedTrendRegion && (
              <button 
                onClick={() => setSelectedTrendRegion(null)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-full transition-colors shadow-sm"
              >
                <ArrowLeft size={16} /> 전체 목록 보기
              </button>
            )}
          </div>
        </div>

        {selectedTrendRegion ? (
          <div className="flex-1 overflow-y-auto pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                style={{ height: 'calc(100vh - 200px)' }}
                data={filteredPolls}
                totalCount={filteredPolls.length}
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