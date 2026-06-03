import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// 💡 2026년 현재 지선 페이로드 생성
const generateCurrentPayload = (cityCode: string, townCode: string) => ({
  electionId: '0020260603',
  requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
  topMenuId: 'VC',
  secondMenuId: 'VCCP08',
  menuId: 'VCCP08',
  statementId: 'VCCP08_#00',
  electionName: '0020260603',
  electionCode: '3',
  cityCode: cityCode,
  sggCityCode: '-1',
  townCodeFromSgg: '-1',
  townCode: townCode,
  sggTownCode: '-1'
});

// 💡 2018년 7대 지선 페이로드 생성
const generatePastPayload = (cityCode: string, townCode: string) => ({
  electionId: '0000000000',
  requestURI: '/electioninfo/0000000000/vc/vccp04.jsp',
  topMenuId: 'VC',
  secondMenuId: 'VCCP04',
  menuId: 'VCCP04',
  statementId: 'VCCP04_#2',
  oldElectionType: '1',
  electionType: '4',
  electionName: '20180613',
  electionCode: '3',
  cityCode: cityCode,
  sggCityCode: '-1',
  townCodeFromSgg: '-1',
  townCode: townCode,
  sggTownCode: '-1',
  x: '74',
  y: '20'
});

interface Region {
  id: string;
  metroName: string;
  localName: string;
  targetTown: string;
  cityCode: string;
  townCode: string;
}

interface TownResult {
  townName: string;
  turnout: number;
  cand1Name: string;
  cand1Rate: number;
  cand1Vote: number;
  cand2Name: string;
  cand2Rate: number;
  cand2Vote: number;
}

interface DashboardItem {
  id: string;
  metroName: string;
  localName: string;
  targetTown: string;
  currentData: TownResult | null; 
  pastData: TownResult | null;    
  countingRate: number | null;
}

const TownResults: React.FC = () => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCSV = async () => {
      try {
        const response = await fetch('/regions.csv');
        const text = await response.text();
        
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const headers = lines[0].split(',').map(h => h.trim());

        const parsedRegions: Region[] = lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim());
          const regionObj: any = {};
          
          headers.forEach((header, i) => {
            regionObj[header] = values[i];
          });

          return {
            id: `region_${index}`,
            metroName: regionObj.metroName,
            localName: regionObj.localName,
            targetTown: regionObj.targetTown,
            cityCode: regionObj.cityCode,
            townCode: regionObj.townCode
          };
        });

        setRegions(parsedRegions);
      } catch (error) {
        console.error("CSV 로드 실패:", error);
        setIsLoading(false);
      }
    };

    loadCSV();
  }, []);

  const fetchAllResults = useCallback(async () => {
    if (regions.length === 0) return;

    setIsLoading(true);
    try {
      const promises = regions.map(async (region) => {
        const currentParams = new URLSearchParams(generateCurrentPayload(region.cityCode, region.townCode)).toString();
        const pastParams = new URLSearchParams(generatePastPayload(region.cityCode, region.townCode)).toString();

        const [currentRes, pastRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/scrape/towns?${currentParams}`),
          fetch(`${API_BASE_URL}/api/scrape/towns?${pastParams}`)
        ]);
        
        let currentTownData = null;
        let pastTownData = null;
        let countingRate = 0;

        if (currentRes.ok) {
          const currentData = await currentRes.json();
          currentTownData = currentData.towns?.find((t: TownResult) => t.townName === region.targetTown) || null;
          countingRate = currentData.countingRate || 0;
        }

        if (pastRes.ok) {
          const pastData = await pastRes.json();
          pastTownData = pastData.towns?.find((t: TownResult) => t.townName === region.targetTown) || null;
        }
        
        return {
          id: region.id,
          metroName: region.metroName,
          localName: region.localName,
          targetTown: region.targetTown,
          currentData: currentTownData,
          pastData: pastTownData,
          countingRate: countingRate
        };
      });

      const results = await Promise.all(promises);
      setDashboardData(results);
    } catch (err) {
      console.error("데이터 로드 실패:", err);
    } finally {
      setIsLoading(false);
    }
  }, [regions]);

  useEffect(() => {
    fetchAllResults();
  }, [fetchAllResults]);

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans">
      <header className="h-16 sm:h-20 bg-white flex items-center justify-between px-4 sm:px-8 border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter">
          종합 개표 상황실
        </h1>
        <div className="flex gap-3">
          <button 
            onClick={fetchAllResults}
            disabled={isLoading || regions.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? '불러오는 중...' : '↻ 실시간 업데이트'}
          </button>
          <Link 
            to="/" 
            className="hidden sm:flex px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
          >
            지도 메인으로
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 lg:p-8">
        {isLoading && dashboardData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
            <p className="font-bold text-lg">전국 상황실 데이터를 동기화 중입니다...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
            {dashboardData.map((item) => (
              <div key={item.id} className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.05)] border border-gray-100 p-6 sm:p-10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow">
                
                {/* ✨ 현재 데이터(2026) 또는 과거 데이터(2018) 둘 중 하나라도 있으면 렌더링 */}
                {item.currentData || item.pastData ? (
                  <div className="flex flex-col gap-8">
                    
                    {/* 공통 타이틀 영역 */}
                    <div className="flex flex-col items-center text-center gap-1">
                      <span className="text-sm font-black text-gray-400 tracking-widest uppercase mb-1">
                        {item.metroName} {item.localName}
                      </span>
                      <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                        {item.targetTown} <span className="text-gray-400 font-bold text-2xl">개표 현황</span>
                      </h2>
                      {/* 현재 선거 데이터가 있을 때만 개표율/투표율 뱃지 표시 */}
                      {item.currentData && item.countingRate !== null && (
                        <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 px-4 py-1.5 rounded-full mt-2">
                          {item.countingRate < 100 && item.countingRate > 0 && (
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                            </span>
                          )}
                          <span className="text-base font-extrabold text-gray-800 tracking-wider">개표율 {item.countingRate}%</span>
                          <span className="text-gray-400 font-bold text-xs ml-2 border-l border-gray-300 pl-3">투표율 {item.currentData.turnout}%</span>
                        </div>
                      )}
                    </div>

                    {/* ✨ 2026년 데이터 구역 */}
                    {item.currentData ? (
                      <div className="flex flex-col gap-6">
                        {/* 막대 그래프 */}
                        <div className="relative w-full h-14 sm:h-16 bg-gray-100 rounded-2xl overflow-hidden flex shadow-inner border border-gray-200">
                          <div style={{ width: `${item.currentData.cand1Rate}%` }} className="bg-[#0073EF] h-full transition-all duration-1000 flex items-center px-4 relative group">
                            <span className="text-white font-black text-lg sm:text-xl drop-shadow-md z-10">{item.currentData.cand1Rate}%</span>
                          </div>
                          <div style={{ width: `${Math.max(0, 100 - item.currentData.cand1Rate - item.currentData.cand2Rate)}%` }} className="bg-gray-200 h-full"></div>
                          <div style={{ width: `${item.currentData.cand2Rate}%` }} className="bg-[#E61E2B] h-full transition-all duration-1000 flex items-center justify-end px-4 relative group">
                            <span className="text-white font-black text-lg sm:text-xl drop-shadow-md z-10">{item.currentData.cand2Rate}%</span>
                          </div>
                          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.3)] z-20 -translate-x-1/2"></div>
                        </div>

                        {/* 후보자 상세 스탯 */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col items-start bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                            <span className="text-2xl font-black text-gray-900 mb-4">{item.currentData.cand1Name}</span>
                            <div className="w-full flex justify-between items-baseline border-b border-blue-100 pb-1 mb-1">
                              <span className="text-gray-500 font-bold text-sm">득표율</span>
                              <span className="text-xl font-black text-[#0073EF]">{item.currentData.cand1Rate}%</span>
                            </div>
                            <div className="w-full flex justify-between items-baseline">
                              <span className="text-gray-500 font-bold text-sm">득표수</span>
                              <span className="text-lg font-bold text-gray-800">{item.currentData.cand1Vote.toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end text-right bg-red-50/50 p-5 rounded-2xl border border-red-100">
                            <span className="text-2xl font-black text-gray-900 mb-4">{item.currentData.cand2Name}</span>
                            <div className="w-full flex justify-between items-baseline border-b border-red-100 pb-1 mb-1">
                              <span className="text-gray-500 font-bold text-sm">득표율</span>
                              <span className="text-xl font-black text-[#E61E2B]">{item.currentData.cand2Rate}%</span>
                            </div>
                            <div className="w-full flex justify-between items-baseline">
                              <span className="text-gray-500 font-bold text-sm">득표수</span>
                              <span className="text-lg font-bold text-gray-800">{item.currentData.cand2Vote.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // 2026년 데이터가 없을 때의 UI
                      <div className="flex flex-col items-center justify-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-300">
                        <p className="text-gray-500 font-bold text-lg">2026년 선거 결과가 아직 집계되지 않았습니다.</p>
                      </div>
                    )}

                    {/* 2018년 과거 선거 결과 구역 */}
                    <div className="mt-2 p-5 bg-gray-50 rounded-2xl border border-gray-200 shadow-sm">
                      <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
                        🕒 2018년 제7대 지선 결과
                        {item.pastData && (
                          <span className="text-xs font-medium text-gray-400 font-normal">
                            (투표율: {item.pastData.turnout}%)
                          </span>
                        )}
                      </h3>
                      
                      {item.pastData ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 w-1/3">
                            <span className="font-bold text-gray-800">{item.pastData.cand1Name}</span>
                            <span className="text-blue-600 font-black text-lg">{item.pastData.cand1Rate}%</span>
                          </div>
                          
                          <div className="w-1/3 px-4">
                            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden flex">
                              <div style={{ width: `${item.pastData.cand1Rate}%` }} className="bg-blue-400 h-full"></div>
                              <div style={{ width: `${item.pastData.cand2Rate}%` }} className="bg-red-400 h-full ml-auto"></div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-3 w-1/3">
                            <span className="text-red-600 font-black text-lg">{item.pastData.cand2Rate}%</span>
                            <span className="font-bold text-gray-800">{item.pastData.cand2Name}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-sm font-medium text-gray-400 py-2">
                          해당 지역의 과거 선거 데이터가 없습니다.
                        </div>
                      )}
                    </div>

                  </div>
                ) : (
                  // 현재, 과거 데이터 둘 다 없을 때의 기존 Fallback UI
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400">
                    <p className="font-bold text-lg">{item.metroName} {item.localName} {item.targetTown} 데이터 없음</p>
                    <p className="text-sm mt-2">선거가 진행되지 않았거나 파라미터가 다릅니다.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default TownResults;