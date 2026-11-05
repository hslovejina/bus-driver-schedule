// 파일 위치: components/modals/ScheduleInputModal.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  CalendarDays,
  MousePointerClick,
  Trash2,
  ChevronLeft,
  Users,
  ArrowRightLeft,
  RotateCcw,
  Check,
} from 'lucide-react';

export interface ShiftHolderInfo {
  bIdx: number;
  dIdx: number;
  name: string;
  busNo: string;
}

interface Props {
  modalObj: { bIdx: number; dIdx: number; day: number; dayType: string } | null;
  onClose: () => void;
  onApply: (workText: string | null, isCustom?: boolean) => void;
  maxDriverOrder: number;
  routeInfo: any;
  takenAm: number[];
  takenPm: number[];
  takenHolderMap?: Record<string, ShiftHolderInfo>;
  onSwapSchedule?: (targetShift: string, holder: ShiftHolderInfo) => void;
  isPrivate: boolean;
  currentWork?: string;
  baseWork?: string;
  hasBaseSchedule?: boolean;
  onOpenSubstitutes?: () => void;
}

export default function ScheduleInputModal({
  modalObj,
  onClose,
  onApply,
  maxDriverOrder,
  routeInfo,
  takenAm,
  takenPm,
  takenHolderMap = {},
  onSwapSchedule,
  isPrivate,
  currentWork = '',
  baseWork = '',
  hasBaseSchedule = false,
  onOpenSubstitutes,
}: Props) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<'MAIN' | 'AM' | 'PM'>('MAIN');
  const [customInput, setCustomInput] = useState('');
  const [pendingSwap, setPendingSwap] = useState<{
    shiftText: string;
    holder: ShiftHolderInfo;
    isFromRestore?: boolean;
  } | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const hasUserDraggedRef = useRef<boolean>(false);

  // 선택된 입력 칸(셀)을 가리지 않는 최적의 모달 좌표를 계산하는 함수
  const updateSmartPosition = useCallback(() => {
    if (!modalObj || !modalRef.current) return;

    const modalEl = modalRef.current;
    const modalRect = modalEl.getBoundingClientRect();
    const modalW = modalRect.width || 360;
    const modalH = modalRect.height || 380;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const topSafe = 52;
    const bottomSafe = vh - 46;
    const cellGap = 22;

    if (hasUserDraggedRef.current) {
      setPosition(prev => ({
        x: Math.min(Math.max(margin, prev.x), Math.max(margin, vw - modalW - margin)),
        y: Math.min(Math.max(topSafe, prev.y), Math.max(topSafe, bottomSafe - modalH)),
      }));
      return;
    }

    const cellEl = document.getElementById(
      `roster-cell-${modalObj.bIdx}-${modalObj.dIdx}-${modalObj.day}`
    );

    if (!cellEl) {
      setPosition({
        x: Math.max(margin, (vw - modalW) / 2),
        y: Math.max(topSafe, (vh - modalH) / 2),
      });
      return;
    }

    const cellRect = cellEl.getBoundingClientRect();
    const stickyLeftEdge = isPrivate ? 206 : 114;

    const spaceRight = vw - margin - (cellRect.right + cellGap);
    const spaceLeftFromSticky = cellRect.left - cellGap - stickyLeftEdge;
    const spaceLeftTotal = cellRect.left - cellGap - margin;
    const spaceBelow = bottomSafe - (cellRect.bottom + cellGap);
    const spaceAbove = cellRect.top - cellGap - topSafe;

    let targetX = margin;
    let targetY = topSafe;

    if (spaceRight >= modalW) {
      targetX = Math.min(cellRect.right + cellGap + 8, vw - modalW - margin);
      const idealY = cellRect.top - 16;
      targetY = Math.min(Math.max(topSafe, idealY), Math.max(topSafe, bottomSafe - modalH));
    } else if (spaceLeftFromSticky >= modalW || spaceLeftTotal >= modalW) {
      const minLeftX = spaceLeftFromSticky >= modalW ? stickyLeftEdge : margin;
      targetX = Math.max(minLeftX, cellRect.left - modalW - cellGap - 8);

      if (spaceBelow >= modalH) {
        targetY = cellRect.bottom + cellGap;
      } else if (spaceAbove >= modalH) {
        targetY = cellRect.top - modalH - cellGap;
      } else {
        const idealY = cellRect.top - modalH / 3;
        targetY = Math.min(Math.max(topSafe, idealY), Math.max(topSafe, bottomSafe - modalH));
      }
    } else if (spaceBelow >= modalH) {
      targetY = cellRect.bottom + cellGap;
      targetX = Math.min(
        Math.max(margin, cellRect.left - modalW / 3),
        Math.max(margin, vw - modalW - margin)
      );
    } else if (spaceAbove >= modalH) {
      targetY = cellRect.top - modalH - cellGap;
      targetX = Math.min(
        Math.max(margin, cellRect.left - modalW / 3),
        Math.max(margin, vw - modalW - margin)
      );
    } else {
      targetX = cellRect.left > vw / 2 ? margin : Math.max(margin, vw - modalW - margin);
      targetY = cellRect.top > vh / 2 ? topSafe : Math.max(topSafe, bottomSafe - modalH);
    }

    setPosition({
      x: Math.round(targetX),
      y: Math.round(targetY),
    });
  }, [modalObj, isPrivate]);

  useEffect(() => {
    if (!modalObj) return;
    setViewMode('MAIN');
    setCustomInput('');
    setPendingSwap(null);
    hasUserDraggedRef.current = false;

    const rafId = requestAnimationFrame(() => {
      updateSmartPosition();
    });
    const timerId = setTimeout(() => {
      updateSmartPosition();
    }, 60);

    const handleScrolled = () => updateSmartPosition();
    window.addEventListener('roster-cell-scrolled', handleScrolled);
    window.addEventListener('resize', handleScrolled);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      window.removeEventListener('roster-cell-scrolled', handleScrolled);
      window.removeEventListener('resize', handleScrolled);
    };
  }, [modalObj, updateSmartPosition]);

  // ✨ PC 키보드 단축키 지원 (ESC: 뒤로/닫기, Delete/Backspace: 빈칸 비우기, 1/2: 오전/오후 선택창)
  useEffect(() => {
    if (!modalObj) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT';

      if (e.key === 'Escape') {
        e.preventDefault();
        if (pendingSwap) {
          setPendingSwap(null);
        } else if (!isPrivate && viewMode !== 'MAIN') {
          setViewMode('MAIN');
        } else {
          onClose();
        }
        return;
      }

      if (isInputFocused) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onApply(null, false);
        return;
      }

      if (!isPrivate && viewMode === 'MAIN') {
        if (e.key === '1') {
          e.preventDefault();
          setPendingSwap(null);
          setViewMode('AM');
        } else if (e.key === '2') {
          e.preventDefault();
          setPendingSwap(null);
          setViewMode('PM');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalObj, viewMode, pendingSwap, isPrivate, onClose, onApply]);

  useEffect(() => {
    const el = modalRef.current;
    if (!el || !modalObj) return;
    const observer = new ResizeObserver(() => {
      updateSmartPosition();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [modalObj, viewMode, pendingSwap, updateSmartPosition]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    hasUserDraggedRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragRef.current || !modalRef.current) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    let newX = dragRef.current.initialX + dx;
    let newY = dragRef.current.initialY + dy;

    const rect = modalRef.current.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - rect.width);
    const maxY = Math.max(0, window.innerHeight - rect.height);

    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX > maxX) newX = maxX;
    if (newY > maxY) newY = maxY;

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleCustomSubmit = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    onApply(trimmed, true);
  };

  if (!modalObj) return null;

  const count = routeInfo?.weekdayCount || maxDriverOrder || 1;
  let drops: number[] = [];
  if (modalObj.dayType === 'SAT') drops = routeInfo?.satDrops || [];
  if (modalObj.dayType === 'SUN' || modalObj.dayType === 'JEOLNAL') drops = routeInfo?.sunDrops || [];

  const trimmedWork = currentWork.trim();
  const trimmedBase = baseWork.trim();
  const showBaseBar = hasBaseSchedule || trimmedBase !== '';
  const isSameAsBase = trimmedWork === trimmedBase;

  const canShowSubstitutes = !isPrivate && (trimmedWork.includes('전') || trimmedWork.includes('후'));

  const handleShiftButtonClick = (shiftText: string, isDropped: boolean, isTaken: boolean) => {
    if (isDropped) return;
    const holder = takenHolderMap[shiftText];
    if (isTaken && holder && onSwapSchedule) {
      setPendingSwap({ shiftText, holder, isFromRestore: false });
      return;
    }
    if (!isTaken) {
      onApply(shiftText, false);
    }
  };

  const handleRestoreBaseWork = () => {
    if (!trimmedBase) {
      onApply(null, false);
      return;
    }
    const holder = takenHolderMap[trimmedBase];
    if (holder && onSwapSchedule) {
      setPendingSwap({ shiftText: trimmedBase, holder, isFromRestore: true });
      return;
    }
    onApply(trimmedBase, false);
  };

  const getBaseBadgeStyle = () => {
    if (!trimmedBase) {
      return 'bg-slate-200 text-slate-600 border-slate-300';
    }
    if (trimmedBase.includes('전')) {
      return 'bg-orange-500 text-white border-orange-600';
    }
    if (trimmedBase.includes('후')) {
      return 'bg-blue-500 text-white border-blue-600';
    }
    return 'bg-indigo-600 text-white border-indigo-700';
  };

  return (
    <div
      ref={modalRef}
      className={`fixed bg-white text-slate-800 shadow-[0_10px_40px_rgba(0,0,0,0.25)] rounded-[24px] xl:rounded-[28px] border border-slate-200 w-[350px] sm:w-[370px] max-h-[94dvh] z-[220] flex flex-col overflow-hidden transition-none ${
        isDragging
          ? 'opacity-90 scale-[1.02] shadow-[0_20px_50px_rgba(0,0,0,0.3)]'
          : 'opacity-100 animate-in zoom-in-95 duration-200'
      }`}
      style={{ left: `${position.x}px`, top: `${position.y}px`, touchAction: 'none' }}
    >
      {/* 상단 드래그 헤더 */}
      <div
        className="bg-slate-50 px-5 py-3 xl:px-6 xl:py-5 flex items-center justify-between border-b border-slate-100 select-none cursor-move shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <CalendarDays size={20} className="text-blue-600 xl:w-[24px] xl:h-[24px]" strokeWidth={2.5} />
          <span className="font-black text-[17px] xl:text-[20px] tracking-tight text-slate-800">
            {modalObj.day}일 근무 선택
          </span>
        </div>
        <button
          onClick={onClose}
          title="닫기 (ESC)"
          className="p-1.5 xl:p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-default"
        >
          <X size={20} strokeWidth={3} className="xl:w-[24px] xl:h-[24px]" />
        </button>
      </div>

      {/* 초기세팅 원본(baseSchedules) 표시 및 원클릭 복원 바 */}
      {showBaseBar && (
        <div className="px-4 py-2 xl:px-5 xl:py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] font-extrabold text-slate-600 shrink-0">
              초기세팅 원본:
            </span>
            <span
              className={`px-2 py-0.5 rounded-md font-black text-[12.5px] border shadow-xs shrink-0 ${getBaseBadgeStyle()}`}
            >
              {trimmedBase
                ? isPrivate && /^\d+$/.test(trimmedBase)
                  ? `${trimmedBase}번`
                  : trimmedBase
                : '휴무(빈칸)'}
            </span>
            {trimmedBase && takenHolderMap[trimmedBase] && !isSameAsBase && (
              <span className="text-[11px] font-bold text-slate-500 truncate">
                ({takenHolderMap[trimmedBase].name} 보유)
              </span>
            )}
          </div>

          {isSameAsBase ? (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
              <Check size={12} strokeWidth={3} /> 원본 유지 중
            </span>
          ) : (
            <button
              type="button"
              onClick={handleRestoreBaseWork}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[12px] rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <RotateCcw size={12} strokeWidth={2.8} /> 원본 복원
            </button>
          )}
        </div>
      )}

      {/* 맞교대 확인 배너 */}
      {pendingSwap && (
        <div className="px-4 py-2.5 bg-indigo-900 text-white flex flex-col gap-2 shrink-0 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2 text-[12.5px] font-bold leading-snug">
            <ArrowRightLeft size={16} className="text-amber-300 shrink-0" />
            <span>
              현재{' '}
              <strong className="text-amber-300">
                {pendingSwap.holder.name}({pendingSwap.holder.busNo})
              </strong>{' '}
              기사님께 배정된 <strong className="underline">{pendingSwap.shiftText}</strong> 근무와
              맞바꾸시겠습니까?
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPendingSwap(null)}
              className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg font-extrabold text-[12px]"
            >
              취소
            </button>
            {pendingSwap.isFromRestore && (
              <button
                type="button"
                onClick={() => {
                  onApply(pendingSwap.shiftText, false);
                  setPendingSwap(null);
                }}
                className="flex-1 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg font-extrabold text-[12px]"
              >
                단독 복원
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onSwapSchedule?.(pendingSwap.shiftText, pendingSwap.holder);
                setPendingSwap(null);
              }}
              className="flex-[1.3] py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg font-black text-[12px] shadow-sm"
            >
              맞교대 실행
            </button>
          </div>
        </div>
      )}

      {/* 본문 영역 */}
      <div
        className="p-4 xl:p-6 flex flex-col bg-white pointer-events-auto cursor-default flex-1 min-h-0 overflow-y-auto"
        style={{ touchAction: 'pan-y' }}
      >
        {viewMode === 'MAIN' && (
          <div className="flex flex-col gap-2.5 xl:gap-3.5 animate-in fade-in duration-200 flex-1 justify-start">
            {isPrivate ? (
              <div className="flex flex-col h-full gap-2.5 xl:gap-3.5">
                <div className="grid grid-cols-5 gap-1.5 xl:gap-2">
                  {Array.from({ length: count }).map((_, i) => {
                    const num = i + 1;
                    const shiftKey = String(num);
                    const isDropped = drops.includes(num);
                    const isTaken = takenAm.includes(num);
                    const holder = takenHolderMap[shiftKey];
                    const isBaseShift = trimmedBase === shiftKey;

                    return (
                      <button
                        key={num}
                        onClick={() => handleShiftButtonClick(shiftKey, isDropped, isTaken)}
                        disabled={isDropped}
                        className={`py-2 min-h-[46px] xl:min-h-[54px] font-black rounded-xl transition-all flex flex-col items-center justify-center relative ${
                          isDropped
                            ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed line-through decoration-slate-300 text-[16px]'
                            : isTaken
                            ? 'bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-700 border border-slate-200 hover:border-indigo-400 cursor-pointer active:scale-95'
                            : 'bg-blue-200/90 hover:bg-blue-600 text-blue-900 hover:text-white border-2 border-blue-400 hover:border-blue-600 shadow-sm active:scale-95 cursor-pointer text-[18px]'
                        } ${isBaseShift ? 'ring-2 ring-indigo-600 ring-offset-1' : ''}`}
                      >
                        <span className="leading-none text-[16px] xl:text-[18px]">{num}</span>
                        {!isDropped && isTaken && holder && (
                          <span className="text-[9.5px] font-bold text-slate-500 mt-0.5 truncate max-w-[44px]">
                            {holder.name}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 xl:gap-4 mt-auto">
                  <button
                    onClick={() => onApply('연차', false)}
                    className="py-3.5 xl:py-5 bg-gradient-to-b from-purple-50 to-purple-100 hover:from-purple-500 hover:to-purple-600 text-purple-700 hover:text-white font-black rounded-xl xl:rounded-2xl transition-all border border-purple-200 hover:border-purple-500 shadow-sm active:scale-95 text-[16px] xl:text-[18px] tracking-widest"
                  >
                    연차
                  </button>
                  <button
                    onClick={() => onApply('신청휴무', false)}
                    className="py-3.5 xl:py-5 bg-gradient-to-b from-red-50 to-red-100 hover:from-red-500 hover:to-red-600 text-red-600 hover:text-white font-black rounded-xl xl:rounded-2xl transition-all border border-red-200 hover:border-red-500 shadow-sm active:scale-95 text-[15px] xl:text-[16px] flex items-center justify-center gap-1"
                  >
                    <X size={18} strokeWidth={3} /> 신청휴무
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCustomSubmit();
                      }
                    }}
                    placeholder="지원 노선 등 직접 입력"
                    className="flex-1 min-w-0 h-[42px] xl:h-[50px] px-3 bg-slate-50 border border-slate-300 rounded-xl xl:rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-black text-[14.5px] xl:text-[16px] text-slate-800 placeholder:text-slate-400 placeholder:font-bold text-center shadow-inner transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleCustomSubmit}
                    className="h-[42px] xl:h-[50px] px-4 xl:px-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl xl:rounded-2xl shadow-sm transition-all active:scale-95 text-[14.5px] xl:text-[16px] shrink-0"
                  >
                    확인
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 xl:gap-4">
                  <button
                    onClick={() => {
                      setPendingSwap(null);
                      setViewMode('AM');
                    }}
                    title="단축키: 숫자 1"
                    className="py-5 xl:py-9 bg-gradient-to-b from-orange-50 to-orange-100 hover:from-orange-500 hover:to-orange-600 text-orange-600 hover:text-white font-black rounded-[16px] xl:rounded-[20px] transition-all border border-orange-200 hover:border-orange-500 shadow-sm active:scale-95 text-[21px] xl:text-[26px] tracking-[0.2em] pl-[0.2em]"
                  >
                    오전
                  </button>
                  <button
                    onClick={() => {
                      setPendingSwap(null);
                      setViewMode('PM');
                    }}
                    title="단축키: 숫자 2"
                    className="py-5 xl:py-9 bg-gradient-to-b from-blue-50 to-blue-100 hover:from-blue-500 hover:to-blue-600 text-blue-600 hover:text-white font-black rounded-[16px] xl:rounded-[20px] transition-all border border-blue-200 hover:border-blue-500 shadow-sm active:scale-95 text-[21px] xl:text-[26px] tracking-[0.2em] pl-[0.2em]"
                  >
                    오후
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 xl:gap-4">
                  <button
                    onClick={() => onApply('연차', false)}
                    className="py-3.5 xl:py-5 bg-gradient-to-b from-purple-50 to-purple-100 hover:from-purple-500 hover:to-purple-600 text-purple-700 hover:text-white font-black rounded-xl xl:rounded-2xl transition-all border border-purple-200 hover:border-purple-500 shadow-sm active:scale-95 text-[17px] xl:text-[20px] tracking-[0.2em] pl-[0.2em]"
                  >
                    연차
                  </button>
                  <button
                    onClick={() => onApply('신청휴무', false)}
                    className="py-3.5 xl:py-5 bg-gradient-to-b from-red-50 to-red-100 hover:from-red-500 hover:to-red-600 text-red-600 hover:text-white font-black rounded-xl xl:rounded-2xl transition-all border border-red-200 hover:border-red-500 shadow-sm active:scale-95 text-[16px] xl:text-[18px] flex items-center justify-center gap-1"
                  >
                    <X size={19} strokeWidth={3} /> 신청휴무
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCustomSubmit();
                      }
                    }}
                    placeholder="지원 노선 등 직접 입력"
                    className="flex-1 min-w-0 h-[42px] xl:h-[50px] px-3 bg-slate-50 border border-slate-300 rounded-xl xl:rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-black text-[14.5px] xl:text-[16px] text-slate-800 placeholder:text-slate-400 placeholder:font-bold text-center shadow-inner transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleCustomSubmit}
                    className="h-[42px] xl:h-[50px] px-4 xl:px-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl xl:rounded-2xl shadow-sm transition-all active:scale-95 text-[14.5px] xl:text-[16px] shrink-0"
                  >
                    확인
                  </button>
                </div>
              </>
            )}

            <hr className="my-0.5 border-slate-100" />

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onApply(null, false)}
                title="단축키: Delete 또는 Backspace"
                className={`${
                  isPrivate ? 'col-span-2' : ''
                } py-3 xl:py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-extrabold rounded-xl xl:rounded-2xl transition-all active:scale-95 text-[14.5px] xl:text-[16px] flex items-center justify-center gap-1.5 border border-slate-200 shadow-xs`}
              >
                <Trash2 size={17} strokeWidth={2.5} /> 빈칸 비우기
              </button>

              {!isPrivate && (
                <button
                  type="button"
                  disabled={!canShowSubstitutes}
                  onClick={() => canShowSubstitutes && onOpenSubstitutes?.()}
                  className={`py-3 xl:py-4 font-extrabold rounded-xl xl:rounded-2xl transition-all text-[14.5px] xl:text-[16px] flex items-center justify-center gap-1.5 border shadow-xs ${
                    canShowSubstitutes
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 active:scale-95 cursor-pointer shadow-indigo-600/20'
                      : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <Users size={17} strokeWidth={2.5} /> 대체자 목록
                </button>
              )}
            </div>
          </div>
        )}

        {!isPrivate && viewMode === 'AM' && (
          <div className="animate-in slide-in-from-right-4 fade-in duration-200 flex flex-col gap-2.5 flex-1">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setPendingSwap(null);
                    setViewMode('MAIN');
                  }}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95 shadow-xs border border-slate-200 cursor-pointer"
                >
                  <ChevronLeft size={19} strokeWidth={3} className="text-slate-700" />
                </button>
                <span className="font-black text-slate-800 text-[16.5px] xl:text-[19px]">
                  오전 순번 선택
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-400">배정된 칸 클릭 시 맞교대</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 xl:gap-2 content-start">
              {Array.from({ length: count }).map((_, i) => {
                const num = i + 1;
                const text = `전${num}`;
                const isDropped = drops.includes(num);
                const isTaken = takenAm.includes(num);
                const holder = takenHolderMap[text];
                const isBaseShift = trimmedBase === text;

                return (
                  <button
                    key={text}
                    onClick={() => handleShiftButtonClick(text, isDropped, isTaken)}
                    disabled={isDropped}
                    className={`py-1.5 min-h-[46px] xl:min-h-[52px] font-black rounded-xl transition-all flex flex-col items-center justify-center relative ${
                      isDropped
                        ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed line-through decoration-slate-300 text-[14px]'
                        : isTaken
                        ? 'bg-white hover:bg-orange-50 text-slate-400 hover:text-orange-700 border border-slate-200 hover:border-orange-400 cursor-pointer active:scale-95'
                        : 'bg-orange-200/85 hover:bg-orange-500 text-orange-900 hover:text-white border-2 border-orange-400 hover:border-orange-500 shadow-sm active:scale-95 cursor-pointer text-[15px]'
                    } ${isBaseShift ? 'ring-2 ring-indigo-600 ring-offset-1' : ''}`}
                  >
                    <span className="leading-none text-[14.5px] xl:text-[15.5px]">{text}</span>
                    {!isDropped && isTaken && holder && (
                      <span className="text-[9.5px] font-bold text-slate-500 mt-0.5 truncate max-w-[44px]">
                        {holder.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!isPrivate && viewMode === 'PM' && (
          <div className="animate-in slide-in-from-right-4 fade-in duration-200 flex flex-col gap-2.5 flex-1">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setPendingSwap(null);
                    setViewMode('MAIN');
                  }}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95 shadow-xs border border-slate-200 cursor-pointer"
                >
                  <ChevronLeft size={19} strokeWidth={3} className="text-slate-700" />
                </button>
                <span className="font-black text-slate-800 text-[16.5px] xl:text-[19px]">
                  오후 순번 선택
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-400">배정된 칸 클릭 시 맞교대</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 xl:gap-2 content-start">
              {Array.from({ length: count }).map((_, i) => {
                const num = i + 1;
                const text = `후${num}`;
                const isDropped = drops.includes(num);
                const isTaken = takenPm.includes(num);
                const holder = takenHolderMap[text];
                const isBaseShift = trimmedBase === text;

                return (
                  <button
                    key={text}
                    onClick={() => handleShiftButtonClick(text, isDropped, isTaken)}
                    disabled={isDropped}
                    className={`py-1.5 min-h-[46px] xl:min-h-[52px] font-black rounded-xl transition-all flex flex-col items-center justify-center relative ${
                      isDropped
                        ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed line-through decoration-slate-300 text-[14px]'
                        : isTaken
                        ? 'bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-700 border border-slate-200 hover:border-indigo-400 cursor-pointer active:scale-95'
                        : 'bg-blue-200/90 hover:bg-blue-600 text-blue-900 hover:text-white border-2 border-blue-400 hover:border-blue-600 shadow-sm active:scale-95 cursor-pointer text-[15px]'
                    } ${isBaseShift ? 'ring-2 ring-indigo-600 ring-offset-1' : ''}`}
                  >
                    <span className="leading-none text-[14.5px] xl:text-[15.5px]">{text}</span>
                    {!isDropped && isTaken && holder && (
                      <span className="text-[9.5px] font-bold text-slate-500 mt-0.5 truncate max-w-[44px]">
                        {holder.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 하단 드래그 핸들 바 */}
      <div
        className="bg-slate-50 py-2 xl:py-3 px-4 border-t border-slate-100 flex items-center justify-center gap-2 select-none rounded-b-[24px] xl:rounded-b-[28px] pointer-events-auto cursor-move shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <MousePointerClick size={15} className="text-slate-400" />
        <span className="text-[12px] xl:text-[13px] font-bold text-slate-400">
          드래그하여 이동 · Delete: 비우기 · ESC: 닫기
        </span>
      </div>
    </div>
  );
}