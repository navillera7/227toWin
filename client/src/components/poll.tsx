import React, { useEffect, useState, useMemo } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Search, Info, Calendar, Users, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface PollData {
  poll_id: string;
  survey_date: string;
  surveyor: string;
  client: string;
  method: string;
  sample_size: string;
  region: string;
  // --- 선거법 필수 추가 항목 ---
  target: string;
  response_rate: string;
  margin_of_error: string;
  confidence_level: string;
  weighting: string;
  // -----------------------
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
  '무소속': '#888888'
};

const Poll: React.FC = () => {
  const [polls, setPolls] = useState<GroupedPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const response = await fetch('/polls.csv');
        const csvText = await response.text();
        
        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rawData = results.data as PollData[];
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
        console.error("로드 에러:", error);
        setLoading(false);
      }
    };
    fetchPolls();
  }, []);

  const sortedAndFilteredPolls = useMemo(() => {
    return polls
      .filter(poll => 
        poll.metadata.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        poll.metadata.surveyor?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => (b.metadata.survey_date || '').localeCompare(a.metadata.survey_date || ''));
  }, [polls, searchTerm]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 font-sans">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-bold">여론조사 데이터를 불러오는 중입니다...</p>
      </div>
    );
  }   

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans text-gray-900">
      <header className="max-w-6xl mx-auto mb-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-6 transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
          지도 페이지로 돌아가기
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-black mb-2">차기 선거 여론조사 현황</h1>
            <p className="text-gray-500">중앙선거여론조사심의위원회 등록 데이터를 기반으로 합니다.</p>
          </div>

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
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {sortedAndFilteredPolls.length > 0 ? (
          sortedAndFilteredPolls.map((poll) => (
            <div key={poll.metadata.poll_id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-lg transition-all duration-300">
              <div className="p-6 bg-slate-50 border-b border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <span className="inline-block px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-md mb-2">
                      {poll.metadata.region}
                    </span>
                    <h2 className="text-xl font-bold leading-tight mb-1">
                      {poll.metadata.surveyor} 조사
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">의뢰: {poll.metadata.client}</p>
                    <p className="text-[11px] text-gray-400 mt-1">대상: {poll.metadata.target}</p>
                  </div>
                  <div className="text-right text-gray-500 text-[11px] space-y-1 font-semibold bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-end gap-1.5"><Calendar size={12} className="text-blue-500"/> {poll.metadata.survey_date}</div>
                    <div className="flex items-center justify-end gap-1.5"><Users size={12} className="text-blue-500"/> N={poll.metadata.sample_size} (응답률 {poll.metadata.response_rate})</div>
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
                    <Bar dataKey="rate" radius={[0, 8, 8, 0]} barSize={28} animationDuration={1000}>
                      {poll.candidates.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PARTY_COLORS[entry.party] || '#cbd5e1'} />
                      ))}
                      <LabelList dataKey="rate" position="right" offset={10} fill="#1e293b" style={{ fontSize: '12px', fontWeight: '900' }} formatter={(v: any) => `${v}%`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

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
                  <p className="leading-relaxed">
                    본 조사는 {poll.metadata.client}의 의뢰로 {poll.metadata.surveyor}가 실시하였습니다. 
                    자세한 사항은 <strong className="text-gray-600">중앙선거여론조사심의위원회 홈페이지</strong>를 참조하시기 바랍니다.
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-32 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <Search size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-bold text-lg">검색 결과가 없습니다.</p>
            <button onClick={() => setSearchTerm('')} className="mt-4 text-blue-500 font-bold hover:underline">초기화</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Poll;