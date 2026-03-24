import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 프론트엔드 비밀번호 강도 체크
    if (!PASSWORD_REGEX.test(password)) {
      return alert("비밀번호는 8자 이상이며, 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.");
    }

    if (password !== confirm) return alert("비밀번호가 일치하지 않습니다.");

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        alert("비밀번호가 성공적으로 변경되었습니다.");
        navigate('/login');
      } else {
        alert("비밀번호 변경 실패. 다시 시도해 주세요.");
      }
    } catch (err) { 
      alert("서버 오류"); 
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <form onSubmit={handleReset} className="bg-white p-8 rounded-2xl shadow-xl w-96 border border-gray-100">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">새 비밀번호 설정</h2>
        
        <div className="mb-4">
          <input 
            type="password" 
            placeholder="새 비밀번호" 
            className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
          <p className="text-xs text-gray-500 mt-2 ml-1">
            * 영문, 숫자, 특수문자 포함 최소 8자 이상
          </p>
        </div>

        <input 
          type="password" 
          placeholder="비밀번호 확인" 
          className="w-full mb-6 p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" 
          value={confirm} 
          onChange={e => setConfirm(e.target.value)} 
          required 
        />
        
        <button className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md">
          비밀번호 변경
        </button>
      </form>
    </div>
  );
};

export default ResetPassword; 