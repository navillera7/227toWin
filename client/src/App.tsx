import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext'; // 경로 확인 필수!
import KoreanElectionPredictor from './components/KoreanElectionPredictor';
import LoginPage from './components/LoginPage';
import Poll from './components/poll'; // 파일명이 poll.tsx이므로 소문자 확인
import EmailVerification from './components/EmailVerification'; // 파일명이 poll.tsx이므로 소문자 확인
import ResetPassword from './components/ResetPassword'; // 파일명이 poll.tsx이므로 소문자 확인
import TownResults from './components/TownResults';

function App() {    
  return (
    // 1. 반드시 AuthProvider가 최상단에 있어야 합니다.
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<KoreanElectionPredictor />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/poll" element={<Poll />} />
          <Route path="/verify-email/:token" element={<EmailVerification />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/town-results" element={<TownResults />} />
        
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;