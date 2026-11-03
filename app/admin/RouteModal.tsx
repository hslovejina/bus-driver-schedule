// 파일 위치: app/admin/RouteModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, BusFront, Edit2, Info, CheckCircle2, CalendarDays, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface Route {
  id: string;
  name: string;
  routeType: string;
  weekdayCount: number;
  satDrops: number[];
  sunDrops: number[];
  longShifts: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function RouteModal({ isOpen, onClose }: Props) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('PUBLIC');
  
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('PUBLIC');
  
  const [editWeekdayCount, setEditWeekdayCount] = useState<number | ''>('');
  const [appliedCount, setAppliedCount] = useState<number>(0);
  const [editSatDrops, setEditSatDrops] = useState<number[]>([]);
  const [editSunDrops, setEditSunDrops] = useState<number[]>([]);
  
  const [editLongShifts, setEditLongShifts] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRoutes();
      setEditingRoute(null);
    }
  }, [isOpen]);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'GET_ROUTES' })
      });
      const data = await response.json();
      
      if (data.error) throw new Error(data.error);
      setRoutes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('노선 데이터 로딩 실패:', err);
      setRoutes([]); 
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ADD_ROUTE', name: newName.trim(), routeType: newType }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      alert('새 노선이 성공적으로 추가되었습니다!');
      setNewName('');
      setNewType('PUBLIC');
      fetchRoutes(); 
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`정말 [${name}] 노선을 삭제하시겠습니까?\n직원들이 더 이상 이 노선을 고를 수 없게 됩니다.`)) return;
    
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_ROUTE', id }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      alert('노선이 삭제되었습니다.');
      fetchRoutes();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEditModal = (route: Route) => {
    setEditingRoute(route);
    setEditName(route.name);
    setEditType(route.routeType || 'PUBLIC');
    setEditWeekdayCount(route.weekdayCount || '');
    setAppliedCount(route.weekdayCount || 0);
    setEditSatDrops(route.satDrops || []);
    setEditSunDrops(route.sunDrops || []);
    setEditLongShifts(route.longShifts || []);
  };

  const handleApplyCount = () => {
    const count = Number(editWeekdayCount);
    if (count > 0) {
      setAppliedCount(count);
      setEditSatDrops(prev => prev.filter(n => n <= count));
      setEditSunDrops(prev => prev.filter(n => n <= count));
      setEditLongShifts(prev => prev.filter(s => {
        const num = parseInt(s.replace(/[^0-9]/g, ''));
        return num <= count;
      }));
    } else {
      alert('운행 대수는 1 이상이어야 합니다.');
    }
  };

  const toggleSatDrop = (num: number) => {
    setEditSatDrops(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  const toggleSunDrop = (num: number) => {
    setEditSunDrops(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  const toggleLongShift = (shift: string) => {
    setEditLongShifts(prev => prev.includes(shift) ? prev.filter(s => s !== shift) : [...prev, shift]);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editingRoute) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'UPDATE_ROUTE', 
          id: editingRoute.id, 
          name: editName.trim(), 
          routeType: editType,
          weekdayCount: Number(editWeekdayCount) || 0,
          satDrops: [...editSatDrops].sort((a, b) => a - b),
          sunDrops: [...editSunDrops].sort((a, b) => a - b),
          longShifts: [...editLongShifts] 
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      alert('노선 정보가 성공적으로 수정되었습니다!');
      setEditingRoute(null);
      fetchRoutes(); 
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-5xl h-[85vh] max-h-[900px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative">
        
        <div className="flex justify-between items-center p-6 border-b bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <BusFront size={28} className="text-blue-600" strokeWidth={2.5} />
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">노선 관리</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors p-1 bg-white rounded-full shadow-sm border border-slate-200">
            <X size={26} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-6 border-b border-slate-100 bg-white shrink-0">
          <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4">
            <div className="flex flex-1 gap-2">
              <input
                type="text"
                placeholder="노선번호 (예: 3103)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 border border-slate-300 rounded-xl px-5 py-4 text-[17px] focus:outline-none focus:ring-2 focus:ring-blue-500 font-extrabold min-w-0 shadow-sm"
                required
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-[120px] shrink-0 border border-slate-300 rounded-xl px-3 py-4 text-[17px] focus:outline-none focus:ring-2 focus:ring-blue-500 font-extrabold bg-slate-50 text-slate-700 shadow-sm"
              >
                <option value="PUBLIC">공공</option>
                <option value="PRIVATE">민영</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="md:w-64 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl transition-all disabled:bg-slate-400 text-[17px] shadow-md active:scale-95 shrink-0"
            >
              {isSubmitting ? '추가 중...' : <><span className="text-xl">+</span><BusFront size={20} /><span>새 노선 추가하기</span></>}
            </button>
          </form>
          <div className="mt-4 bg-blue-50/80 p-4 rounded-xl border border-blue-200 flex items-start gap-2.5 shadow-sm">
            <Info size={20} className="text-blue-600 mt-0.5 shrink-0" strokeWidth={2.5} />
            <p className="text-[14px] font-bold text-blue-800 leading-relaxed break-keep">
              💡 새 노선 추가 후 우측의 <strong className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-700">수정</strong> 버튼을 눌러 <strong className="text-blue-900 underline underline-offset-2">운행 대수</strong>와 <strong className="text-blue-900 underline underline-offset-2">휴일 감차/긴근무 순번</strong>을 꼭 설정해 주세요.
            </p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 bg-slate-50 relative">
          <h3 className="text-[14px] font-extrabold text-slate-500 mb-4 tracking-widest flex items-center gap-1.5">
            <CheckCircle2 size={16} /> 등록된 노선 목록
          </h3>
          {loading ? (
            <div className="text-center py-8 text-slate-400 font-bold text-[16px]">불러오는 중...</div>
          ) : routes.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-[16px] font-bold">등록된 노선이 없습니다.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routes.map((route) => (
                <div key={route.id} className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  
                  <div className="flex items-center gap-3">
                    <div className="font-black text-slate-900 text-[20px] min-w-[70px]">
                      {route.name}
                    </div>
                    <span className={`px-3 py-1.5 rounded-lg text-[13px] font-black tracking-wide ${route.routeType === 'PRIVATE' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                      {route.routeType === 'PRIVATE' ? '민영' : '공공'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditModal(route)} className="px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl transition-colors font-bold text-[15px] flex items-center gap-1.5 shadow-sm active:scale-95">
                      <Edit2 size={18} strokeWidth={2.5} /> 수정
                    </button>
                    <button onClick={() => handleDelete(route.id, route.name)} className="px-4 py-2.5 bg-red-50 border border-red-200 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-colors font-bold text-[15px] flex items-center gap-1.5 shadow-sm active:scale-95">
                      <Trash2 size={18} strokeWidth={2.5} /> 삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {editingRoute && (
          <div className="absolute inset-0 bg-slate-50 z-50 flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="flex justify-between items-center p-6 border-b bg-white shrink-0 shadow-sm z-10">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <Edit2 size={24} className="text-blue-600" strokeWidth={2.5} />
                노선 상세 정보 수정
              </h3>
              <button onClick={() => setEditingRoute(null)} className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 rounded-full p-2 border border-slate-200 shadow-sm active:scale-95">
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="p-6 md:p-8 flex-1 overflow-y-auto">
              <form onSubmit={handleEditSubmit} className="flex flex-col gap-6 h-full max-w-6xl mx-auto">
                
                {/* ✨ items-end 적용으로 하단 정렬, 운행대수 길이를 줄여 콤팩트하게 구성 */}
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-end">
                  
                  {/* 노선 번호 (가운데 정렬) */}
                  <div className="w-full lg:w-[160px]">
                    <label className="block text-center text-[15px] font-black text-slate-700 mb-2">노선 번호</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full h-[52px] border border-slate-300 rounded-xl px-4 text-[17px] focus:outline-none focus:ring-2 focus:ring-blue-500 font-extrabold text-slate-800 shadow-sm bg-white text-center"
                      required
                    />
                  </div>
                  
                  {/* 노선 형태 (배경색 통일, 파란색 큰 꺾쇠) */}
                  <div className="w-full lg:w-[140px] relative">
                    <label className="block text-center text-[15px] font-black text-slate-700 mb-2">노선 형태</label>
                    <div className="relative h-[52px]">
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="w-full h-full appearance-none border border-slate-300 rounded-xl pl-4 pr-10 text-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500 font-extrabold bg-white text-slate-800 shadow-sm cursor-pointer text-center"
                      >
                        <option value="PUBLIC">공공</option>
                        <option value="PRIVATE">민영</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <ChevronDown size={24} strokeWidth={3.5} className="text-blue-600" />
                      </div>
                    </div>
                  </div>
                  
                  {/* 운행 대수 (노선 번호와 동일한 너비, 텐션있는 커스텀 스피너 버튼) */}
                  <div className="w-full lg:w-[160px]">
                    <label className="block text-center text-[15px] font-black text-slate-700 mb-2">
                      운행 대수
                    </label>
                    <div className="relative h-[52px]">
                      <input
                        type="text"
                        placeholder="예: 15"
                        value={editWeekdayCount}
                        onChange={(e) => setEditWeekdayCount(Number(e.target.value.replace(/[^0-9]/g, '')) || '')}
                        className="w-full h-full border border-slate-300 rounded-xl pr-12 text-[18px] focus:outline-none focus:ring-2 focus:ring-blue-500 font-black text-slate-800 shadow-sm bg-white text-center appearance-none m-0"
                        required
                      />
                      {/* 커스텀 연한색 스피너 */}
                      <div className="absolute right-1.5 top-1.5 bottom-1.5 flex flex-col gap-[2px] w-[34px]">
                        <button
                          type="button"
                          onClick={() => setEditWeekdayCount((Number(editWeekdayCount) || 0) + 1)}
                          className="flex-1 flex items-center justify-center bg-blue-50/50 hover:bg-blue-100 text-blue-400 hover:text-blue-600 rounded-t-[8px] transition-colors active:scale-95"
                        >
                          <ChevronUp size={18} strokeWidth={4} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditWeekdayCount(Math.max(1, (Number(editWeekdayCount) || 0) - 1))}
                          className="flex-1 flex items-center justify-center bg-red-50/50 hover:bg-red-100 text-red-400 hover:text-red-600 rounded-b-[8px] transition-colors active:scale-95"
                        >
                          <ChevronDown size={18} strokeWidth={4} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 적용하기 버튼 (위 라인들과 정확하게 밑면 정렬) */}
                  <div className="w-full lg:w-auto h-[52px]">
                    <button
                      type="button"
                      onClick={handleApplyCount}
                      className="w-full lg:w-[130px] h-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-xl text-[16px] tracking-wide shadow-md active:scale-95 transition-all flex items-center justify-center"
                    >
                      적용하기
                    </button>
                  </div>

                </div>

                {appliedCount > 0 ? (
                  <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm flex flex-col gap-8 flex-1 mt-2">
                    
                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="flex-1">
                        <label className="flex items-center justify-between text-[16px] font-black text-slate-800 mb-4">
                          <span className="flex items-center gap-1.5"><CalendarDays size={18} className="text-orange-500"/> 토요일 감차 지정</span>
                          <span className="text-[12px] font-extrabold px-2.5 py-1 bg-slate-100 text-slate-500 rounded-md border border-slate-200">
                            회색(취소선) = 감차
                          </span>
                        </label>
                        <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                          {Array.from({ length: appliedCount }).map((_, i) => {
                            const num = i + 1;
                            const isDropped = editSatDrops.includes(num);
                            return (
                              <button
                                type="button"
                                key={`sat-${num}`}
                                onClick={() => toggleSatDrop(num)}
                                className={`py-3.5 rounded-xl font-black text-[18px] transition-all border shadow-sm active:scale-95 ${
                                  isDropped
                                    ? 'bg-slate-100 text-slate-400 border-slate-300 line-through decoration-slate-400 hover:bg-slate-200 hover:text-slate-500 cursor-pointer'
                                    : 'bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white border-orange-200 hover:border-orange-500'
                                }`}
                              >
                                {num}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="hidden md:block w-[1px] bg-slate-200 my-2 rounded-full"></div>

                      <div className="flex-1">
                        <label className="flex items-center justify-between text-[16px] font-black text-slate-800 mb-4">
                          <span className="flex items-center gap-1.5"><CalendarDays size={18} className="text-red-500"/> 일/공휴일 감차 지정</span>
                        </label>
                        <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                          {Array.from({ length: appliedCount }).map((_, i) => {
                            const num = i + 1;
                            const isDropped = editSunDrops.includes(num);
                            return (
                              <button
                                type="button"
                                key={`sun-${num}`}
                                onClick={() => toggleSunDrop(num)}
                                className={`py-3.5 rounded-xl font-black text-[18px] transition-all border shadow-sm active:scale-95 ${
                                  isDropped
                                    ? 'bg-slate-100 text-slate-400 border-slate-300 line-through decoration-slate-400 hover:bg-slate-200 hover:text-slate-500 cursor-pointer'
                                    : 'bg-red-50 hover:bg-red-500 text-red-600 hover:text-white border-red-200 hover:border-red-500'
                                }`}
                              >
                                {num}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <hr className="border-slate-200" />

                    <div>
                      <label className="flex items-center justify-between text-[16px] font-black text-slate-800 mb-5">
                        <span className="flex items-center gap-1.5"><Clock size={18} className="text-slate-600"/> 긴근무 순번 설정</span>
                        <span className="text-[12px] font-extrabold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                          색상이 채워지면 긴근무 지정
                        </span>
                      </label>
                      
                      <div className="flex flex-col gap-4">
                        {/* 오전 긴근무 (오렌지 테마) */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="w-12 text-orange-600 font-black text-[16px]">오전</div>
                          <div className="flex-1 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2.5">
                            {Array.from({ length: appliedCount }).map((_, i) => {
                              const text = `전${i + 1}`;
                              const isLong = editLongShifts.includes(text);
                              return (
                                <button
                                  type="button"
                                  key={`ls-${text}`}
                                  onClick={() => toggleLongShift(text)}
                                  className={`py-3 rounded-xl font-black text-[15px] transition-all border active:scale-95 ${
                                    isLong
                                      ? 'bg-orange-500 border-orange-600 text-white shadow-md shadow-orange-500/30'
                                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-orange-50 hover:text-orange-500 hover:border-orange-300 shadow-sm'
                                  }`}
                                >
                                  {text}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 오후 긴근무 (블루 테마) */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2 sm:mt-0">
                          <div className="w-12 text-blue-600 font-black text-[16px]">오후</div>
                          <div className="flex-1 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2.5">
                            {Array.from({ length: appliedCount }).map((_, i) => {
                              const text = `후${i + 1}`;
                              const isLong = editLongShifts.includes(text);
                              return (
                                <button
                                  type="button"
                                  key={`ls-${text}`}
                                  onClick={() => toggleLongShift(text)}
                                  className={`py-3 rounded-xl font-black text-[15px] transition-all border active:scale-95 ${
                                    isLong
                                      ? 'bg-blue-500 border-blue-600 text-white shadow-md shadow-blue-500/30'
                                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-blue-50 hover:text-blue-500 hover:border-blue-300 shadow-sm'
                                  }`}
                                >
                                  {text}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 p-12 rounded-2xl flex flex-col items-center justify-center text-center mt-2 flex-1">
                    <CalendarDays size={48} className="text-slate-200 mb-4" strokeWidth={2} />
                    <span className="text-[18px] font-black text-slate-400">운행 대수를 입력 후 [적용하기] 버튼을 눌러주세요.</span>
                  </div>
                )}
                
                <div className="flex gap-3 pt-2 mt-auto shrink-0 bg-slate-50 border-t border-slate-200 -mx-6 md:-mx-8 px-6 md:px-8 py-4 -mb-6 md:-mb-8">
                  <button type="button" onClick={() => setEditingRoute(null)} className="w-[120px] bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-extrabold text-[17px] py-4 rounded-xl transition-colors shadow-sm active:scale-95">
                    취소
                  </button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black text-[17px] py-4 rounded-xl transition-colors shadow-md disabled:bg-blue-400 active:scale-95">
                    {isSubmitting ? '수정 중...' : '상세 정보 저장'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}