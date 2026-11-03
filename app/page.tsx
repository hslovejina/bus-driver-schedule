// 파일 위치: app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BusFront } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isSaved, setIsSaved] = useState(false);
  const [isAutoLogin, setIsAutoLogin] = useState(false);

  useEffect(() => {
    const savedEmpId = localStorage.getItem('savedEmpId');
    const autoLogin = localStorage.getItem('autoLogin') === 'true';
    const currentUser = localStorage.getItem('currentUser');

    if (autoLogin && currentUser) {
      router.replace('/main');
    }

    if (savedEmpId) {
      setEmpId(savedEmpId);
      setIsSaved(true);
    }
    if (autoLogin) {
      setIsAutoLogin(true);
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // ✨ 실제 DB 로그인 API 호출
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empId, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '로그인에 실패했습니다.');
        setIsLoading(false);
        return;
      }

      // 로그인 성공 처리
      localStorage.setItem('currentUser', JSON.stringify(data.user));

      if (isSaved) localStorage.setItem('savedEmpId', empId);
      else localStorage.removeItem('savedEmpId');

      if (isAutoLogin) localStorage.setItem('autoLogin', 'true');
      else localStorage.removeItem('autoLogin');

      router.replace('/main');
    } catch (err) {
      setError('서버와 통신할 수 없습니다.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8 border border-slate-100">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
            <BusFront size={36} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">배차 메이커</h1>
          <p className="text-sm text-slate-500 font-bold mt-1.5">기사 배차 스케줄링 시스템</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1.5 ml-1">사원번호</label>
            <input
              type="text"
              value={empId}
              onChange={(e) => setEmpId(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="예: 621028"
              className="w-full border border-slate-300 p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-semibold"
              required
            />
          </div>
          
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1.5 ml-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="초기 비밀번호 (생년월일 6자리)"
              className="w-full border border-slate-300 p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-semibold"
              required
            />
          </div>

          <div className="flex items-center justify-between pt-2 pb-1 px-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="saveEmpId"
                checked={isSaved}
                onChange={(e) => setIsSaved(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="saveEmpId" className="text-[13.5px] font-bold text-slate-600 cursor-pointer select-none mt-0.5">
                사원번호 기억하기
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoLogin"
                checked={isAutoLogin}
                onChange={(e) => setIsAutoLogin(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="autoLogin" className="text-[13.5px] font-bold text-slate-600 cursor-pointer select-none mt-0.5">
                자동 로그인
              </label>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-[13px] font-bold text-center bg-red-50 p-2.5 rounded-lg border border-red-100">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full text-white font-bold py-4 rounded-xl transition duration-200 mt-2 shadow-md ${isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
          >
            {isLoading ? '확인 중...' : '로그인'}
          </button>
        </form>
      </div>
           
      {/* ✨ 로그인 화면 하단 제작자 표기 푸터 */}
      <div className="w-full text-center py-6 mt-auto flex flex-col items-center justify-center gap-1">
        <p className="text-[13px] font-bold text-slate-500 tracking-tight">
          Designed & Developed by <strong className="text-slate-800 font-extrabold">Kim Hyun-Soo</strong>
        </p>
        <p className="text-[11.5px] font-semibold text-slate-400">
          © 2026 배차메이커.
        </p>
      </div>
    </div>
    
  );
}