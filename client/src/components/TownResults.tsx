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
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tighter">
          종합 개표 상황실
        </h1>
        <div className="flex gap-3">
          <button 
            onClick={fetchAllResults}
            disabled={isLoading || regions.length === 0}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs sm:text-sm hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? '로딩 중...' : '↻ 업데이트'}
          </button>
          <Link 
            to="/" 
            className="hidden sm:flex px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
          >
            지도 메인으로
          </Link>
        </div>
      </header>

      {/* ✨ max-w를 조금 더 넓혀서 4개가 충분히 들어갈 수 있게 조정했습니다 */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-6">
        {isLoading && dashboardData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-600"></div>
            <p className="font-bold text-sm sm:text-base">전국 상황실 데이터를 동기화 중입니다...</p>
          </div>
        ) : (
          /* ✨ grid-cols-4로 한 줄에 4개씩 들어가도록 조정하고 갭을 줄였습니다. */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
            {dashboardData.map((item) => (
              /* ✨ 패딩과 둥근 모서리를 약간 줄여서 콤팩트하게 만들었습니다. */
              <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 hover:shadow-md transition-shadow">
                
                {item.currentData || item.pastData ? (
                  <div className="flex flex-col gap-5">
                    
                    {/* 공통 타이틀 영역 */}
                    <div className="flex flex-col items-center text-center gap-1">
                      <span className="text-[11px] font-black text-gray-400 tracking-widest uppercase mb-0.5">
                        {item.metroName} {item.localName}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                        {item.targetTown} <span className="text-gray-400 font-bold text-lg">개표</span>
                      </h2>
                      {item.currentData && item.countingRate !== null && (
                        <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full mt-1">
                          {item.countingRate < 100 && item.countingRate > 0 && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                          )}
                          <span className="text-sm font-extrabold text-gray-800">개표율 {item.countingRate}%</span>
                          <span className="text-gray-400 font-bold text-[11px] ml-1 border-l border-gray-300 pl-2">투표율 {item.currentData.turnout}%</span>
                        </div>
                      )}
                    </div>

                    {/* ✨ 2026년 데이터 구역 */}
                    {item.currentData ? (
                      <div className="flex flex-col gap-4">
                        {/* 콤팩트 막대 그래프 */}
                        <div className="relative w-full h-8 sm:h-10 bg-gray-100 rounded-xl overflow-hidden flex shadow-inner border border-gray-200">
                          <div style={{ width: `${item.currentData.cand1Rate}%` }} className="bg-[#0073EF] h-full transition-all duration-1000 flex items-center px-3 relative group">
                            <span className="text-white font-black text-sm drop-shadow-md z-10">{item.currentData.cand1Rate}%</span>
                          </div>
                          <div style={{ width: `${Math.max(0, 100 - item.currentData.cand1Rate - item.currentData.cand2Rate)}%` }} className="bg-gray-200 h-full"></div>
                          <div style={{ width: `${item.currentData.cand2Rate}%` }} className="bg-[#E61E2B] h-full transition-all duration-1000 flex items-center justify-end px-3 relative group">
                            <span className="text-white font-black text-sm drop-shadow-md z-10">{item.currentData.cand2Rate}%</span>
                          </div>
                          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white shadow-sm z-20 -translate-x-1/2"></div>
                        </div>

                        {/* 후보자 상세 스탯 콤팩트 버전 */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          <div className="flex flex-col items-start bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                            <span className="text-base sm:text-lg font-black text-gray-900 mb-2 truncate w-full">{item.currentData.cand1Name}</span>
                            <div className="w-full flex justify-between items-baseline border-b border-blue-100 pb-1 mb-1">
                              <span className="text-gray-500 font-bold text-xs">득표율</span>
                              <span className="text-base font-black text-[#0073EF]">{item.currentData.cand1Rate}%</span>
                            </div>
                            <div className="w-full flex justify-between items-baseline">
                              <span className="text-gray-500 font-bold text-xs">득표수</span>
                              <span className="text-sm font-bold text-gray-800">{item.currentData.cand1Vote.toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end text-right bg-red-50/50 p-3 rounded-xl border border-red-100">
                            <span className="text-base sm:text-lg font-black text-gray-900 mb-2 truncate w-full">{item.currentData.cand2Name}</span>
                            <div className="w-full flex justify-between items-baseline border-b border-red-100 pb-1 mb-1">
                              <span className="text-gray-500 font-bold text-xs">득표율</span>
                              <span className="text-base font-black text-[#E61E2B]">{item.currentData.cand2Rate}%</span>
                            </div>
                            <div className="w-full flex justify-between items-baseline">
                              <span className="text-gray-500 font-bold text-xs">득표수</span>
                              <span className="text-sm font-bold text-gray-800">{item.currentData.cand2Vote.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 bg-gray-50/50 rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-400 font-bold text-sm">2026년 결과 미집계</p>
                      </div>
                    )}

                    {/* 2018년 과거 선거 결과 콤팩트 버전 */}
                    <div className="mt-0 p-3 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                      <h3 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                        🕒 2018년 결과
                        {item.pastData && (
                          <span className="text-[10px] font-medium text-gray-400 font-normal">
                            (투표율: {item.pastData.turnout}%)
                          </span>
                        )}
                      </h3>
                      
                      {item.pastData ? (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 w-[35%]">
                            <span className="font-bold text-gray-800 truncate">{item.pastData.cand1Name}</span>
                            <span className="text-blue-600 font-black">{item.pastData.cand1Rate}%</span>
                          </div>
                          
                          <div className="w-[30%] px-2">
                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
                              <div style={{ width: `${item.pastData.cand1Rate}%` }} className="bg-blue-400 h-full"></div>
                              <div style={{ width: `${item.pastData.cand2Rate}%` }} className="bg-red-400 h-full ml-auto"></div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 w-[35%]">
                            <span className="text-red-600 font-black">{item.pastData.cand2Rate}%</span>
                            <span className="font-bold text-gray-800 truncate">{item.pastData.cand2Name}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-xs font-medium text-gray-400 py-1">
                          과거 데이터 없음
                        </div>
                      )}
                    </div>

                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-400">
                    <p className="font-bold text-sm">{item.metroName} {item.localName}</p>
                    <p className="font-bold text-base mb-1">{item.targetTown}</p>
                    <p className="text-xs">데이터 없음</p>
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