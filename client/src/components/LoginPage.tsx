import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        if (isRegister) {
          // 메시지를 구체적으로 변경
          alert("인증 메일이 발송되었습니다! 메일함(또는 스팸함)을 확인하여 인증을 완료해주세요."); 
          setIsRegister(false); // 로그인 폼으로 전환
        } else {
          login(data.token, data.predictions);
          navigate('/');
        }
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("서버 연결 실패");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">{isRegister ? '회원가입' : '로그인'}</h2>
        <input type="email" placeholder="이메일" className="w-full mb-4 p-2 border rounded" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="비밀번호" className="w-full mb-6 p-2 border rounded" value={password} onChange={e => setPassword(e.target.value)} required />
        <button className="w-full bg-blue-600 text-white py-2 rounded font-bold mb-4">{isRegister ? '가입하기' : '로그인'}</button>
        <p className="text-center text-sm text-gray-500 cursor-pointer" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? '이미 계정이 있나요? 로그인' : '처음이신가요? 회원가입'}
        </p>
      </form>
    </div>
  );
};

export default LoginPage;