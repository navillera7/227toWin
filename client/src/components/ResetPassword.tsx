import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (err) { alert("서버 오류"); }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <form onSubmit={handleReset} className="bg-white p-8 rounded-2xl shadow-xl w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">비밀번호 재설정</h2>
        <input type="password" placeholder="새 비밀번호" className="w-full mb-4 p-2 border rounded" value={password} onChange={e => setPassword(e.target.value)} required />
        <input type="password" placeholder="비밀번호 확인" className="w-full mb-6 p-2 border rounded" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        <button className="w-full bg-blue-600 text-white py-2 rounded font-bold">비밀번호 변경</button>
      </form>
    </div>
  );
};

export default ResetPassword;