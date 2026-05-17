import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// (기존 파일에 있는 PARTY_COLORS 재사용)
const PARTY_COLORS: { [key: string]: string } = {
  '더불어민주당': '#004ea2',
  '국민의힘': '#e61e2b',
  '개혁신당': '#EE7B1E',
  '조국혁신당': '#0073CF',
  '진보당': '#8000FF',
  '무소속': '#888888'
};

interface PollData {
  poll_id: string;
  survey_date: string;
  region: string;
  candidate_name: string;
  party: string;
  support_rate: number;
}

interface RegionTrendChartProps {
  data: PollData[];      // 전체 CSV 원본 데이터
  targetRegion: string;  // 검색할 정확한 지역명 (예: "서울특별시")
}

const RegionTrendChart: React.FC<RegionTrendChartProps> = ({ data, targetRegion }) => {
  const { trendData, candidates, partyMap } = useMemo(() => {
    // 1. 정확히 해당 지역인 데이터만 필터링
    const regionData = data.filter(poll => poll.region === targetRegion);

    const dataByDate: { [key: string]: any } = {};
    const candidateSet = new Set<string>();
    const partyMapping: { [key: string]: string } = {};

    // 2. 날짜별로 그룹핑 (Recharts LineChart 형식에 맞춤)
    regionData.forEach(poll => {
      if (!dataByDate[poll.survey_date]) {
        dataByDate[poll.survey_date] = { survey_date: poll.survey_date };
      }
      // 해당 날짜 객체에 후보명으로 지지율 저장
      dataByDate[poll.survey_date][poll.candidate_name] = poll.support_rate;
      
      // 후보자 목록 및 정당 정보 저장
      candidateSet.add(poll.candidate_name);
      partyMapping[poll.candidate_name] = poll.party;
    });

    // 3. 날짜 오름차순으로 정렬
    const sortedTrendData = Object.values(dataByDate).sort((a, b) => 
      a.survey_date.localeCompare(b.survey_date)
    );

    return {
      trendData: sortedTrendData,
      candidates: Array.from(candidateSet),
      partyMap: partyMapping
    };
  }, [data, targetRegion]);

  if (trendData.length === 0) {
    return <div className="p-4 text-center text-gray-500">해당 지역의 추이 데이터가 없습니다.</div>;
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8">
      <h2 className="text-xl font-bold mb-4">{targetRegion} 여론조사 추이</h2>
      
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={trendData}
            margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            
            <XAxis 
              dataKey="survey_date" 
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickMargin={10}
            />
            
            <YAxis 
              domain={[0, 'auto']}
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={(value) => `${value}%`}
            />
            
            <Tooltip 
  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
  formatter={(value: any) => [`${value}%`]} // 👈 여기를 any로 변경!
  labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
/>
            
            <Legend wrapperStyle={{ paddingTop: '20px' }} />

            {/* 4. 후보자 수만큼 동적으로 Line(추세선) 생성 */}
            {candidates.map((candidateName, index) => {
              const party = partyMap[candidateName];
              const color = PARTY_COLORS[party] || '#888888';
              
              return (
                <Line
                  key={candidateName}
                  type="monotone"
                  dataKey={candidateName}
                  name={`${candidateName} (${party})`}
                  stroke={color}
                  strokeWidth={3}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  connectNulls={true} // 중간에 조사가 없는 경우 선을 이어줌
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RegionTrendChart;