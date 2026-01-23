import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';

const EmailVerification = () => {
  const { token } = useParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const hasCalled = useRef(false); // 중복 호출 방지용 플래그

  useEffect(() => {
    // 이미 호출 중이거나 완료했다면 리턴
    if (hasCalled.current) return;
    hasCalled.current = true;

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email/${token}`);
        if (res.ok) {
          setStatus('success');
        } else {
          // 실패하더라도 이전에 성공했다면 상태를 바꾸지 않음
          setStatus(prev => prev === 'success' ? 'success' : 'error');
        }
      } catch (err) {
        setStatus(prev => prev === 'success' ? 'success' : 'error');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-sm w-full border border-gray-100">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-blue-600 font-bold">인증 정보 확인 중...</p>
          </div>
        )}
        {status === 'success' && (
          <>
            <div className="text-6xl mb-6">✅</div>
            <h2 className="text-2xl font-extrabold mb-3 text-gray-800">인증 완료!</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">이메일 인증이 성공적으로 처리되었습니다.<br/>이제 모든 기능을 사용할 수 있습니다.</p>
            <Link to="/login" className="block w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all">
              로그인하러 가기
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-6xl mb-6">❌</div>
            <h2 className="text-2xl font-extrabold mb-3 text-gray-800">인증 실패</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">이미 인증되었거나 만료된 링크입니다.<br/>문제가 지속되면 관리자에게 문의하세요.</p>
            <Link to="/login" className="text-blue-600 font-bold text-sm hover:underline">
              로그인 페이지로 돌아가기
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailVerification;