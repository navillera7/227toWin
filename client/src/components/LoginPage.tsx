import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ReCAPTCHA from "react-google-recaptcha"; 

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
// 보안 강화: 최소 8자, 영문 1개, 숫자 1개, 특수문자 1개 이상 포함
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // 봇 방지 및 브루트포스 방어용 상태
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // 락아웃(Lockout) 타이머 로직: 5회 실패 시 일정 시간 동안 로그인 차단
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLocked && lockoutTime > 0) {
      timer = setInterval(() => setLockoutTime((prev) => prev - 1), 1000);
    } else if (isLocked && lockoutTime === 0) {
      setIsLocked(false);
      setFailedAttempts(0);
    }
    return () => clearInterval(timer);
  }, [isLocked, lockoutTime]);

  const handleFailedAttempt = (msg: string) => {
    alert(msg);
    recaptchaRef.current?.reset();
    setRecaptchaToken(null);
    setPassword(''); // 실패 시 비밀번호 입력창 초기화
    
    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);
    
    if (newAttempts >= 5) {
      setIsLocked(true);
      setLockoutTime(30); // 30초 동안 차단
      alert("로그인에 5회 연속 실패하여 30초 동안 시도가 제한됩니다.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      alert(`너무 많은 시도가 있었습니다. ${lockoutTime}초 후에 다시 시도해주세요.`);
      return;
    }

    // 회원가입 시 비밀번호 유효성 검사
    if (isRegister && !PASSWORD_REGEX.test(password)) {
      alert("비밀번호는 8자 이상이며, 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.");
      return;
    }

    // 리캡챠 검증 (환경변수가 설정되어 있을 때만 필수 체크)
    if (!recaptchaToken && import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
      alert("봇 방지를 위해 체크박스를 클릭해주세요.");
      return;
    }

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 백엔드에도 recaptchaToken을 보내서 검증해야 완벽한 방어가 됩니다.
        body: JSON.stringify({ email, password, recaptchaToken }),
      });
      const data = await res.json();

      if (res.ok) {
        setFailedAttempts(0); // 성공 시 실패 카운트 초기화
        if (isRegister) {
          alert("인증 메일이 발송되었습니다! 메일함(또는 스팸함)을 확인하여 인증을 완료해주세요."); 
          setIsRegister(false);
          setPassword('');
          recaptchaRef.current?.reset();
        } else {
          login(data.token, data.predictions);
          navigate('/');
        }
      } else {
        handleFailedAttempt(data.message || "로그인 실패");
      }
    } catch (err) {
      handleFailedAttempt("서버 연결 실패");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">{isRegister ? '회원가입' : '로그인'}</h2>
        
        <input 
          type="email" 
          placeholder="이메일" 
          className="w-full mb-4 p-2 border rounded focus:ring-2 focus:ring-blue-400 outline-none" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          required 
          disabled={isLocked}
        />
        
        <input 
          type="password" 
          placeholder="비밀번호" 
          className="w-full mb-6 p-2 border rounded focus:ring-2 focus:ring-blue-400 outline-none" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          required 
          disabled={isLocked}
        />
        
        {/* 회원가입 시 비밀번호 규칙 안내 */}
        {isRegister && (
          <p className="text-xs text-gray-500 mb-4 -mt-4">
            * 영문, 숫자, 특수문자 포함 최소 8자 이상
          </p>
        )}

        {/* reCAPTCHA 위젯: .env 파일에 VITE_RECAPTCHA_SITE_KEY 를 추가해야 렌더링 됩니다. */}
        {import.meta.env.VITE_RECAPTCHA_SITE_KEY && (
          <div className="mb-4 flex justify-center">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
              onChange={(token) => setRecaptchaToken(token)}
              size="compact"
            />
          </div>
        )}

        <button 
          type="submit"
          disabled={isLocked}
          className={`w-full py-2 rounded font-bold mb-4 transition-colors ${
            isLocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLocked 
            ? `잠김 (${lockoutTime}초)` 
            : (isRegister ? '가입하기' : '로그인')
          }
        </button>
        
        <p className="text-center text-sm text-gray-500 cursor-pointer hover:text-blue-600" 
           onClick={() => {
             if(isLocked) return;
             setIsRegister(!isRegister);
             setFailedAttempts(0);
             recaptchaRef.current?.reset();
             setRecaptchaToken(null);
           }}>
          {isRegister ? '이미 계정이 있나요? 로그인' : '처음이신가요? 회원가입'}
        </p>
      </form>
    </div>
  );
};

export default LoginPage;