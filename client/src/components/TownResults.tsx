import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// 💡 광역(metroName)과 기초(localName) 속성을 추가했습니다!
const HARDCODED_REGIONS = [
  { 
    id: 'ulju_beomseo', 
    metroName: '울산광역시',
    localName: '울주군',
    targetTown: '범서읍', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '3100',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '3105',
      sggTownCode: '-1'
    }
  },  { 
    id: 'ulju_beomseo', 
    metroName: '울산광역시',
    localName: '울주군',
    targetTown: '청량읍', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '3100',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '3105',
      sggTownCode: '-1'
    }
  },
  { 
    id: 'geojae_aju', 
    metroName: '경상남도',
    localName: '거제시',
    targetTown: '아주동', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '4800',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '4810',
      sggTownCode: '-1'
    }
  }, { 
    id: 'geojae_aju', 
    metroName: '울산광역시',
    localName: '동구',
    targetTown: '남목2동', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '3100',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '3103',
      sggTownCode: '-1'
    }
  }, { 
    id: 'geojae_aju', 
    metroName: '울산광역시',
    localName: '북구',
    targetTown: '농소3동', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '3100',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '3104',
      sggTownCode: '-1'
    }
  }, { 
    id: 'geojae_aju', 
    metroName: '울산광역시',
    localName: '남구',
    targetTown: '무거동', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '3100',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '3102',
      sggTownCode: '-1'
    }
  }, { 
    id: 'geojae_aju', 
    metroName: '경상남도',
    localName: '김해시',
    targetTown: '장유3동', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '4800',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '4808',
      sggTownCode: '-1'
    }
  }, { 
    id: 'geojae_aju', 
    metroName: '경상남도',
    localName: '진주시',
    targetTown: '충무공동', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '4800',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '4803',
      sggTownCode: '-1'
    }
  }, { 
    id: 'geojae_aju', 
    metroName: '경상남도',
    localName: '창원시 성산구',
    targetTown: '사파동', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '4800',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '4822',
      sggTownCode: '-1'
    }, 
  } , { 
    id: 'geojae_aju', 
    metroName: '경상남도',
    localName: '창원시 진해구',
    targetTown: '웅동2동', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '4800',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '4825',
      sggTownCode: '-1'
    }, 
  } , { 
    id: 'geojae_aju', 
    metroName: '경상남도',
    localName: '양산시',
    targetTown: '물금읍', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '4800',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '4814',
      sggTownCode: '-1'
    }, 
  } , { 
    id: 'geojae_aju', 
    metroName: '부산특별시',
    localName: '기장군',
    targetTown: '정관읍', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '2600',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '2610',
      sggTownCode: '-1'
    }, 
  } , { 
    id: 'geojae_aju', 
    metroName: '부산특별시',
    localName: '강서구',
    targetTown: '명지2동', 
    payload: {
      electionId: '0020260603',
      requestURI: '/electioninfo/0020260603/vc/vccp08.jsp',
      topMenuId: 'VC',
      secondMenuId: 'VCCP08',
      menuId: 'VCCP08',
      statementId: 'VCCP08_#00',
      electionName: '0020260603',
      electionCode: '3',
      cityCode: '2600',
      sggCityCode: '-1',
      townCodeFromSgg: '-1',
      townCode: '2610',
      sggTownCode: '-1'
    }, 
  } 
];

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

// 💡 DashboardItem 인터페이스에도 반영했습니다.
interface DashboardItem {
  id: string;
  metroName: string;
  localName: string;
  targetTown: string;
  townData: TownResult | null;
  countingRate: number | null;
}

const TownResults: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllResults = async () => {
    setIsLoading(true);
    try {
      const promises = HARDCODED_REGIONS.map(async (region) => {
        const queryParams = new URLSearchParams(region.payload).toString();
        const res = await fetch(`${API_BASE_URL}/api/scrape/towns?${queryParams}`);
        
        if (res.ok) {
          const data = await res.json();
          const targetData = data.towns?.find((t: TownResult) => t.townName === region.targetTown);
          
          return {
            id: region.id,
            metroName: region.metroName, // 데이터 매핑
            localName: region.localName, // 데이터 매핑
            targetTown: region.targetTown,
            townData: targetData || null,
            countingRate: data.countingRate || 0
          };
        }
        return { ...region, townData: null, countingRate: null };
      });

      const results = await Promise.all(promises);
      setDashboardData(results);
    } catch (err) {
      console.error("데이터 로드 실패:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllResults();
  }, []);

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans">
      <header className="h-16 sm:h-20 bg-white flex items-center justify-between px-4 sm:px-8 border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter">
          종합 개표 상황실
        </h1>
        <div className="flex gap-3">
          <button 
            onClick={fetchAllResults}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
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
                
                {item.townData ? (
                  <div className="flex flex-col gap-8">
                    {/* ✨ 카드 타이틀 & 개표율 구역 수정됨 */}
                    <div className="flex flex-col items-center text-center gap-1">
                      {/* 광역 및 기초 단체 이름 표시 */}
                      <span className="text-sm font-black text-gray-400 tracking-widest uppercase mb-1">
                        {item.metroName} {item.localName}
                      </span>
                      <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                        {item.targetTown} <span className="text-gray-400 font-bold text-2xl">개표 현황</span>
                      </h2>
                      {item.countingRate !== null && (
                        <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 px-4 py-1.5 rounded-full mt-2">
                          {item.countingRate < 100 && item.countingRate > 0 && (
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                            </span>
                          )}
                          <span className="text-base font-extrabold text-gray-800 tracking-wider">개표율 {item.countingRate}%</span>
                          <span className="text-gray-400 font-bold text-xs ml-2 border-l border-gray-300 pl-3">투표율 {item.townData.turnout}%</span>
                        </div>
                      )}
                    </div>

                    {/* 막대 그래프 */}
                    <div className="relative w-full h-14 sm:h-16 bg-gray-100 rounded-2xl overflow-hidden flex shadow-inner border border-gray-200">
                      <div style={{ width: `${item.townData.cand1Rate}%` }} className="bg-[#0073EF] h-full transition-all duration-1000 flex items-center px-4 relative group">
                        <span className="text-white font-black text-lg sm:text-xl drop-shadow-md z-10">{item.townData.cand1Rate}%</span>
                      </div>
                      <div style={{ width: `${Math.max(0, 100 - item.townData.cand1Rate - item.townData.cand2Rate)}%` }} className="bg-gray-200 h-full"></div>
                      <div style={{ width: `${item.townData.cand2Rate}%` }} className="bg-[#E61E2B] h-full transition-all duration-1000 flex items-center justify-end px-4 relative group">
                        <span className="text-white font-black text-lg sm:text-xl drop-shadow-md z-10">{item.townData.cand2Rate}%</span>
                      </div>
                      <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.3)] z-20 -translate-x-1/2"></div>
                    </div>

                    {/* 후보자 상세 스탯 */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* 1번 후보 */}
                      <div className="flex flex-col items-start bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                        <span className="text-2xl font-black text-gray-900 mb-4">{item.townData.cand1Name}</span>
                        <div className="w-full flex justify-between items-baseline border-b border-blue-100 pb-1 mb-1">
                          <span className="text-gray-500 font-bold text-sm">득표율</span>
                          <span className="text-xl font-black text-[#0073EF]">{item.townData.cand1Rate}%</span>
                        </div>
                        <div className="w-full flex justify-between items-baseline">
                          <span className="text-gray-500 font-bold text-sm">득표수</span>
                          <span className="text-lg font-bold text-gray-800">{item.townData.cand1Vote.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* 2번 후보 */}
                      <div className="flex flex-col items-end text-right bg-red-50/50 p-5 rounded-2xl border border-red-100">
                        <span className="text-2xl font-black text-gray-900 mb-4">{item.townData.cand2Name}</span>
                        <div className="w-full flex justify-between items-baseline border-b border-red-100 pb-1 mb-1">
                          <span className="text-gray-500 font-bold text-sm">득표율</span>
                          <span className="text-xl font-black text-[#E61E2B]">{item.townData.cand2Rate}%</span>
                        </div>
                        <div className="w-full flex justify-between items-baseline">
                          <span className="text-gray-500 font-bold text-sm">득표수</span>
                          <span className="text-lg font-bold text-gray-800">{item.townData.cand2Vote.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
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