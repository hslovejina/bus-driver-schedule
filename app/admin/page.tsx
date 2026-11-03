// 파일 위치: app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Undo2, X, CalendarDays, BusFront, UserPlus, ShieldAlert, KeyRound, Coins } from 'lucide-react';
import RouteModal from './RouteModal';
import WageConfigModal from './WageConfigModal';

export default function AdminDashboard() {
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [globalWage, setGlobalWage] = useState(16911);
  const [isWageModalOpen, setIsWageModalOpen] = useState(false);
  const [editWage, setEditWage] = useState(16911);
  const [applyAllPast, setApplyAllPast] = useState(false); 
  
  const [newUser, setNewUser] = useState({ empId: '', name: '', birthDate: '', password: '', route: '미지정', role: 'USER' });
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editUser, setEditUser] = useState<any>({});
  const [payConfig, setPayConfig] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (parsed.role !== 'ADMIN') {
        alert('관리자 권한이 없습니다.');
        router.replace('/main');
      } else {
        fetchData();
      }
    } else {
      router.replace('/');
    }
  }, [router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, routesRes, settingsRes] = await Promise.all([
        fetch('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'GET_USERS' }) }),
        fetch('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'GET_ROUTES' }) }),
        fetch('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'GET_SETTINGS' }) })
      ]);
      const usersData = await usersRes.json();
      const routesData = await routesRes.json();
      const settingsData = await settingsRes.json();

      setUsers(Array.isArray(usersData) ? usersData : []);
      setRoutes(Array.isArray(routesData) ? routesData : []);
      if (settingsData && settingsData.baseHourlyWage) {
        setGlobalWage(settingsData.baseHourlyWage);
      }
      if (settingsData && settingsData.payConfig) {
        setPayConfig(settingsData.payConfig);
      }
    } catch (e) {
      console.error(e);
      setUsers([]);
      setRoutes([]);
    }
    setLoading(false);
  };

  const handleUpdateWage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(`기본 시급을 ${editWage.toLocaleString()}원으로 변경하시겠습니까?`)) return;

    const res = await fetch('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'UPDATE_WAGE', wage: editWage, applyAllPast })
    });
    if (res.ok) {
      alert('시급이 성공적으로 업데이트되었습니다.');
      setGlobalWage(editWage);
      setIsWageModalOpen(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'ADD_USER', payload: newUser })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    
    alert('새 직원이 등록되었습니다.');
    setIsAddModalOpen(false);
    setNewUser({ empId: '', name: '', birthDate: '', password: '', route: '미지정', role: 'USER' });
    fetchData();
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'UPDATE_USER', id: selectedUser.id, payload: editUser })
    });
    if (res.ok) {
      alert('정보가 수정되었습니다.');
      const updatedUser = await res.json();

      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        if (currentUser.empId === updatedUser.empId) {
          const { password: _, ...safeUserInfo } = updatedUser;
          localStorage.setItem('currentUser', JSON.stringify(safeUserInfo));
        }
      }

      setIsEditModalOpen(false);
      fetchData();
    }
  };

  const handleToggleActive = async () => {
    const newStatus = !editUser.isActive;
    await fetch('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'UPDATE_USER', id: selectedUser.id, payload: { isActive: newStatus } })
    });
    setEditUser({ ...editUser, isActive: newStatus });
    fetchData();
  };

  const handleDeleteUser = async () => {
    await fetch('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'DELETE_USER', id: selectedUser.id })
    });
    alert('삭제되었습니다.');
    setIsDeleteModalOpen(false);
    setIsEditModalOpen(false);
    fetchData();
  };

  const handleResetPassword = async () => {
    if (!confirm(`비밀번호를 생년월일(${selectedUser.birthDate})로 강제 초기화하시겠습니까?`)) return;

    const res = await fetch('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'RESET_PASSWORD', id: selectedUser.id })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    
    alert('비밀번호가 초기화되었습니다.');
  };

  const handleSyncHolidays = async () => {
    if (!confirm('공공데이터포털에서 최신 휴일 정보를 가져오시겠습니까? (1~2초 소요)')) return;
    const res = await fetch('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'SYNC_HOLIDAYS' }) });
    const data = await res.json();
    if (data.error) alert(data.error);
    else alert(data.message);
  };

  const filteredUsers = users.filter(u => u.name.includes(searchTerm) || u.empId.includes(searchTerm));

  if (loading) return <div className="p-10 text-center text-slate-500 font-bold text-lg">데이터를 불러오는 중입니다...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
        
        <div className="relative flex items-center justify-center mb-8">
          <button onClick={() => { sessionStorage.setItem('returnToSettings', 'true'); router.push('/main'); }} className="absolute left-0 p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
            <Undo2 size={32} strokeWidth={2.5} />
          </button>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="text-blue-600" size={32} /> 관리자 대시보드
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <input 
            type="text" 
            placeholder="이름 또는 사번 검색" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full sm:w-80 px-5 py-3 border border-slate-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold shadow-sm" 
          />
          <div className="flex flex-wrap items-center justify-end w-full sm:w-auto gap-3">
            <button onClick={() => { setEditWage(globalWage); setIsWageModalOpen(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 px-4 py-3 rounded-xl font-bold transition-all shadow-sm text-[15px] whitespace-nowrap">
              <Coins size={20} strokeWidth={2.5} /> 시급 설정
            </button>
            <button onClick={handleSyncHolidays} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl font-bold transition-all shadow-sm text-[15px] whitespace-nowrap">
              <CalendarDays size={20} strokeWidth={2.5} /> 공휴일 동기화
            </button>
            <button onClick={() => setIsRouteModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 px-4 py-3 rounded-xl font-bold transition-all shadow-sm text-[15px] whitespace-nowrap">
              <BusFront size={20} strokeWidth={2.5} /> 노선 관리
            </button>
            <button onClick={() => setIsAddModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-sm text-[15px] whitespace-nowrap">
              <UserPlus size={20} strokeWidth={2.5} /> 새 직원 등록
            </button>
          </div>
        </div>

        <div className="bg-white shadow-md rounded-2xl overflow-hidden border border-slate-200">
          <table className="w-full table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-[20%] py-4 text-center text-[16px] font-bold text-slate-600 tracking-wide">사원번호</th>
                <th className="w-[20%] py-4 text-center text-[16px] font-bold text-slate-600 tracking-wide">이름</th>
                <th className="w-[25%] py-4 text-center text-[16px] font-bold text-slate-600 tracking-wide">관리노선</th>
                <th className="w-[15%] py-4 text-center text-[16px] font-bold text-slate-600 tracking-wide">상태</th>
                <th className="w-[20%] py-4 text-center text-[16px] font-bold text-slate-600 tracking-wide">설정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const routeInfo = routes.find(r => r.name === user.route);

                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 text-center text-slate-800 font-extrabold text-[17px]">{user.empId}</td>
                    
                    <td className="py-4 text-center font-bold text-slate-800 text-[17px]">{user.name}</td>
                    
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`font-extrabold text-[17px] ${user.route === '미지정' ? 'text-slate-400' : 'text-blue-600'}`}>
                          {user.route}
                        </span>
                        {user.route !== '미지정' && routeInfo && (
                          <span className={`px-2 py-0.5 rounded-md text-[12px] font-extrabold tracking-wide border ${routeInfo.routeType === 'PRIVATE' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>
                            {routeInfo.routeType === 'PRIVATE' ? '민영' : '공공'}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 text-center">
                      {user.role === 'ADMIN' ? (
                        <span className="text-[12px] bg-red-100 text-red-600 border border-red-200 font-extrabold px-2.5 py-1 rounded-md tracking-wider shadow-sm">ADMIN</span>
                      ) : (
                        <span className={`text-[15px] font-bold ${user.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>{user.isActive ? '활성화' : '비활성화'}</span>
                      )}
                    </td>
                    
                    <td className="py-4 text-center">
                      <button 
                        onClick={() => { setSelectedUser(user); setEditUser(user); setIsEditModalOpen(true); }} 
                        className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 px-5 py-2.5 rounded-xl text-[14px] font-bold transition shadow-sm active:scale-95"
                      >
                        정보수정 / 비번초기화
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <WageConfigModal
        isOpen={isWageModalOpen}
        globalWage={globalWage}
        payConfig={payConfig}
        onClose={() => setIsWageModalOpen(false)}
        onSaved={fetchData}
      />

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md p-7 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">새 직원 등록</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-full"><X size={24}/></button>
            </div>
            <form onSubmit={handleAddUser} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5">사원번호</label>
                <input type="text" required value={newUser.empId} onChange={e => setNewUser({...newUser, empId: e.target.value.replace(/[^0-9]/g, '')})} className="w-full border border-slate-300 p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 text-[15px] font-bold outline-none" placeholder="예: 621000" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5">이름</label>
                <input type="text" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full border border-slate-300 p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 text-[15px] font-bold outline-none" placeholder="홍길동" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5">생년월일 (6자리)</label>
                <input type="text" required maxLength={6} value={newUser.birthDate} onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setNewUser({...newUser, birthDate: val, password: val}); 
                }} className="w-full border border-slate-300 p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500 text-[15px] font-bold outline-none" placeholder="예: 850101" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5">관리노선 설정</label>
                <select value={newUser.route} onChange={e => setNewUser({...newUser, route: e.target.value})} className="w-full border border-slate-300 p-3.5 rounded-xl text-[15px] font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="미지정">미지정 (추후 선택)</option>
                  {routes.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5">권한</label>
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full border border-slate-300 p-3.5 rounded-xl text-[15px] font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="USER">일반 직원 (USER)</option>
                  <option value="ADMIN">관리자 (ADMIN)</option>
                </select>
              </div>
              <button type="submit" className="w-full mt-3 bg-blue-600 text-white font-extrabold py-4 text-[16px] rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-md">등록 완료</button>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md p-7 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-black text-slate-800">직원 상세 관리</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-full"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="flex flex-col gap-5 mb-2">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-600 mb-1.5">이름</label>
                  <input type="text" required value={editUser.name} onChange={e => setEditUser({...editUser, name: e.target.value})} className="w-full border border-slate-300 p-3 rounded-xl text-[15px] font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-600 mb-1.5">생년월일(6자리)</label>
                  <input type="text" required maxLength={6} value={editUser.birthDate || ''} onChange={e => setEditUser({...editUser, birthDate: e.target.value.replace(/[^0-9]/g, '')})} className="w-full border border-slate-300 p-3 rounded-xl text-[15px] font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-600 mb-1.5">관리노선</label>
                  <select value={editUser.route} onChange={e => setEditUser({...editUser, route: e.target.value})} className="w-full border border-slate-300 p-3 rounded-xl text-[15px] font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="미지정">미지정</option>
                    {routes.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-600 mb-1.5">권한</label>
                  <select value={editUser.role} onChange={e => setEditUser({...editUser, role: e.target.value})} className="w-full border border-slate-300 p-3 rounded-xl text-[15px] font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              {selectedUser.role !== 'ADMIN' && (
                <div className="flex gap-3 mt-4 mb-1">
                  <button type="button" onClick={handleToggleActive} className={`flex-1 font-extrabold text-[15px] py-3.5 rounded-xl transition-colors ${editUser.isActive ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'}`}>
                    {editUser.isActive ? '비활성화' : '활성화'}
                  </button>
                  <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="flex-1 bg-red-50 text-red-600 border border-red-200 font-extrabold text-[15px] py-3.5 rounded-xl hover:bg-red-100 transition-colors">
                    탈퇴
                  </button>
                </div>
              )}

              <div className="bg-red-50/50 border border-red-100 rounded-xl p-5 my-3 flex justify-between items-center">
                <h3 className="font-extrabold text-[16px] text-red-600 flex items-center gap-2">
                  <KeyRound size={20} strokeWidth={2.5}/> 비밀번호 강제 초기화
                </h3>
                <button onClick={handleResetPassword} type="button" className="px-5 py-2.5 bg-red-600 text-white font-extrabold text-[15px] rounded-xl hover:bg-red-700 shadow-sm active:scale-95 transition-all">
                  초기화
                </button>
              </div>

              <button type="submit" className="w-full bg-slate-800 text-white font-extrabold py-4 text-[16px] rounded-xl hover:bg-slate-900 transition-colors mt-2 shadow-md">정보 수정 저장</button>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 z-[600] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-7 animate-in zoom-in-95 duration-200 text-center">
            <h3 className="text-2xl font-black text-slate-800 mb-3">회원 영구 탈퇴</h3>
            <p className="text-[15px] font-bold text-red-500 mb-8 break-keep leading-relaxed">
              정말 {selectedUser.name} 회원의 정보를 완전히 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 font-extrabold text-[15px] py-3.5 rounded-xl hover:bg-gray-200 transition-colors">취소</button>
              <button onClick={handleDeleteUser} className="flex-1 bg-red-600 text-white font-extrabold text-[15px] py-3.5 rounded-xl hover:bg-red-700 shadow-sm transition-colors">영구 탈퇴 확인</button>
            </div>
          </div>
        </div>
      )}

      <RouteModal isOpen={isRouteModalOpen} onClose={() => { setIsRouteModalOpen(false); fetchData(); }} />

    </div>
  );
}