// 파일 위치: components/SettingsView.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { User, Briefcase, Settings, X, ShieldAlert, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsView() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);

  const [activeModal, setActiveModal] = useState<'PASSWORD' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const savedUserStr = localStorage.getItem('currentUser');
    if (!savedUserStr) {
      router.replace('/');
      return;
    }
    const savedUser = JSON.parse(savedUserStr);
    setCurrentUser(savedUser);

    fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'GET_LATEST_INFO', empId: savedUser.empId }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          localStorage.setItem('currentUser', JSON.stringify(data.user));
          setCurrentUser(data.user);
        }
      })
      .catch(console.error);

    fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'GET_ROUTES' }),
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRoutes(data);
      })
      .catch(() => setRoutes([]));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('autoLogin');
    router.replace('/');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHANGE_PASSWORD',
          empId: currentUser.empId,
          oldPassword,
          newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      alert('비밀번호가 성공적으로 변경되었습니다. 다음 접속 시 새 비밀번호를 사용해주세요.');
      setActiveModal(null);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      alert('서버와 통신할 수 없습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser) return null;

  const currentRouteInfo = routes.find(r => r.name === currentUser.route);

  return (
    <div className="w-full h-full overflow-hidden bg-slate-50 text-slate-800 flex flex-col items-center justify-center px-4 py-2">
      <div className="w-full max-w-2xl flex flex-col gap-3">
        {/* 상단 타이틀 */}
        <div className="flex items-center gap-2 px-1">
          <Settings size={22} className="text-blue-600" strokeWidth={2.5} />
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight">내 정보 설정</h2>
        </div>

        {/* 1. 계정 정보 */}
        <section>
          <h3 className="text-xs font-extrabold text-slate-500 mb-1 ml-1.5 flex items-center gap-1">
            <User size={13} strokeWidth={2.5} /> 계정 정보
          </h3>
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 flex flex-col overflow-hidden">
            <div className="flex border-b border-slate-100">
              <div className="w-[30%] sm:w-[25%] bg-slate-50 font-bold py-2 sm:py-2.5 border-r border-slate-100 flex items-center justify-center text-[13.5px]">
                이름
              </div>
              <div className="w-[70%] sm:w-[75%] px-4 font-extrabold text-[14.5px] flex items-center">
                {currentUser.name}
              </div>
            </div>
            <div className="flex border-b border-slate-100">
              <div className="w-[30%] sm:w-[25%] bg-slate-50 font-bold py-2 sm:py-2.5 border-r border-slate-100 flex items-center justify-center text-[13.5px]">
                사원번호
              </div>
              <div className="w-[70%] sm:w-[75%] px-4 font-extrabold text-[14.5px] flex items-center">
                {currentUser.empId}
              </div>
            </div>
            <div className="flex">
              <div className="w-[30%] sm:w-[25%] bg-slate-50 font-bold py-2 sm:py-2.5 border-r border-slate-100 flex items-center justify-center text-[13.5px]">
                비밀번호
              </div>
              <div className="w-[70%] sm:w-[75%] px-4 py-1.5 flex items-center">
                <button
                  onClick={() => setActiveModal('PASSWORD')}
                  className="w-full sm:w-auto px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors active:scale-95 text-[13px]"
                >
                  변경하기
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. 근무 정보 설정 */}
        <section>
          <h3 className="text-xs font-extrabold text-slate-500 mb-1 ml-1.5 flex items-center gap-1">
            <Briefcase size={13} strokeWidth={2.5} /> 근무 정보 설정
          </h3>
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 flex flex-col overflow-hidden">
            <div className="flex">
              <div className="w-[30%] sm:w-[25%] bg-slate-50 font-bold py-2 sm:py-2.5 border-r border-slate-100 flex items-center justify-center text-[13.5px]">
                관리노선
              </div>

              <div className="w-[70%] sm:w-[75%] px-4 py-2 flex items-center gap-2">
                <span
                  className={`font-extrabold text-[14.5px] border px-2.5 py-0.5 rounded-lg ${
                    currentUser.route === '미지정'
                      ? 'text-slate-500 bg-slate-100 border-slate-200'
                      : 'text-blue-600 bg-blue-50 border-blue-100'
                  }`}
                >
                  {currentUser.route}
                </span>

                {currentUser.route !== '미지정' && currentRouteInfo && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold tracking-wide border ${
                      currentRouteInfo.routeType === 'PRIVATE'
                        ? 'bg-orange-100 text-orange-700 border-orange-200'
                        : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                    }`}
                  >
                    {currentRouteInfo.routeType === 'PRIVATE' ? '민영' : '공공'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 3. 관리자 대시보드 입장 카드 */}
        {currentUser.role === 'ADMIN' && (
          <div className="bg-slate-800 rounded-2xl p-3.5 shadow-sm border border-slate-700 animate-in fade-in">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldAlert size={18} className="text-yellow-400" strokeWidth={2.5} />
              <h3 className="font-bold text-white text-[13.5px]">관리자 권한 활성화됨</h3>
            </div>
            <button
              onClick={() => {
                sessionStorage.setItem('returnToSettings', 'true');
                router.push('/admin');
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[14px] py-2.5 rounded-xl shadow-xs transition-all active:scale-95"
            >
              관리자 대시보드 입장하기
            </button>
          </div>
        )}

        {/* 4. 로그아웃 버튼 */}
        <button
          onClick={handleLogout}
          className="w-full bg-white border border-red-200 hover:bg-red-50 text-red-500 py-2.5 rounded-2xl font-extrabold text-[14px] transition flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
        >
          <LogOut size={16} strokeWidth={2.5} /> 로그아웃
        </button>

        {/* 5. 제작자 표기 푸터 (로그아웃 버튼 바로 아래에 여백 최소화 배치) */}
        <div className="w-full text-center pt-1 flex flex-col items-center justify-center gap-0.5">
          <p className="text-[11.5px] font-bold text-slate-500 tracking-tight leading-none">
            Designed & Developed by <strong className="text-slate-800 font-extrabold">Kim Hyun-Soo</strong>
          </p>
          <p className="text-[10.5px] font-semibold text-slate-400 leading-none mt-0.5">© 2026 배차메이커.</p>
        </div>
      </div>

      {activeModal === 'PASSWORD' && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-sm max-h-[92dvh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-black text-[18px] text-slate-800">비밀번호 변경</h3>
              <button
                onClick={() => !isSaving && setActiveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 bg-white">
              <form onSubmit={handlePasswordChange} className="flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">기존 비밀번호</label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    className="w-full border border-slate-300 p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-[15px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">새 비밀번호</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full border border-slate-300 p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-[15px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">새 비밀번호 확인</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full border border-slate-300 p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-[15px]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`w-full mt-3 text-white font-extrabold py-4 rounded-xl text-[16px] transition-all active:scale-95 shadow-sm ${
                    isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isSaving ? '저장 중...' : '변경 완료'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}