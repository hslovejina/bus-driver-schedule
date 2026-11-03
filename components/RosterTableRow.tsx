// 파일 위치: components/RosterTableRow.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowUp, ArrowDown, Share2, Trash2 } from 'lucide-react';
import {
  calculateRowStats,
  getDayType,
  isNormalPrivateShift,
  isPrivateWorkDay,
  type DriverInfo,
  type RowStatsResult,
} from '../utils/calculator';

const DOW_OPTIONS = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  bIdx: number;
  dIdx: number;
  busGroup: any;
  driver: DriverInfo;
  rowStats?: RowStatsResult;
  cellWarnings?: Record<number, string[]>;
  todayDay?: number | null;
  highlightFilter?: string;
  searchQuery?: string;
  year: number;
  month: number;
  daysArray: number[];
  holidays: Record<string, string>;
  rosterDataLength: number;
  isLastInGroup: boolean;
  nameAlign?: 'left' | 'right';
  isMenuActive: boolean;
  isDriverEditing: boolean;
  editingBusIndex: number | null;
  scheduleModalObj: { bIdx: number; dIdx: number; day: number; dayType: string } | null;
  hourlyWage: number;
  maxSalary: number;
  minSalary: number;
  showLongShifts: boolean;
  sortedLongShifts: string[];
  routeType: string;
  prevMonthLastDayWork: string;
  nextMonthFirstDayWork: string;
  duplicateShifts: Record<number, string[]>;
  routeInfo: any;
  allRoutes: { name: string; routeType: string }[];
  maxDriverOrder: number;
  setActiveMenuIndex: (val: { bIdx: number; dIdx: number } | null) => void;
  setEditingBusIndex: (val: number | null) => void;
  setEditingDriver: (val: { bIdx: number; dIdx: number } | null) => void;
  setScheduleModalObj: (val: any) => void;
  moveRowUp: (idx: number) => void;
  moveRowDown: (idx: number) => void;
  handleRowDelete: (idx: number) => void;
  handleBusEditConfirmUI: (bIdx: number, newBusNo: string) => boolean;
  handleDriverEditConfirmUI: (bIdx: number, dIdx: number, newName: string) => void;
  handleClearDriverSchedulesUI?: (bIdx: number, dIdx: number) => void;
  handleDefaultRestSaveUI?: (
    bIdx: number,
    dIdx: number,
    restDays: string[],
    syncPartner: boolean
  ) => void;
  onOpenShareModal?: (bIdx: number, dIdx: number) => void;
  onShowToast?: (msg: string, type?: 'SUCCESS' | 'WARNING', subMsg?: string) => void;
}

function RosterTableRowComponent(props: Props) {
  const {
    bIdx,
    dIdx,
    busGroup,
    driver,
    rowStats: passedRowStats,
    cellWarnings = {},
    todayDay = null,
    highlightFilter = 'ALL',
    searchQuery = '',
    year,
    month,
    daysArray,
    holidays,
    rosterDataLength,
    isLastInGroup,
    nameAlign,
    isMenuActive,
    isDriverEditing,
    editingBusIndex,
    scheduleModalObj,
    hourlyWage,
    maxSalary,
    minSalary,
    showLongShifts,
    sortedLongShifts,
    routeType,
    prevMonthLastDayWork,
    nextMonthFirstDayWork,
    duplicateShifts,
    routeInfo,
    allRoutes,
    maxDriverOrder,
    setActiveMenuIndex,
    setEditingBusIndex,
    setEditingDriver,
    setScheduleModalObj,
    moveRowUp,
    moveRowDown,
    handleRowDelete,
    handleBusEditConfirmUI,
    handleDriverEditConfirmUI,
    handleClearDriverSchedulesUI,
    handleDefaultRestSaveUI,
    onOpenShareModal,
  } = props;

  const [localBusEditVal, setLocalBusEditVal] = useState('');
  const [localDriverEditVal, setLocalDriverEditVal] = useState('');
  // ✨ 첫 요일 1개만 선택하면 다음 연속 요일이 자동으로 짝지어지도록 단일 상태로 변경
  const [restStartDay, setRestStartDay] = useState<string>('일');
  const [syncPartnerRest, setSyncPartnerRest] = useState<boolean>(true);

  const editBusInputRef = useRef<HTMLInputElement>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);

  const isSpBus = busGroup.busNo.trim().toUpperCase() === 'SP';
  const hasPartnerInGroup = !isSpBus && busGroup.drivers.length > 1;

  useEffect(() => {
    if (editingBusIndex === bIdx && isMenuActive) {
      setLocalBusEditVal(busGroup.busNo);
      setTimeout(() => editBusInputRef.current?.focus(), 0);
    }
  }, [editingBusIndex, bIdx, isMenuActive, busGroup.busNo]);

  useEffect(() => {
    if (isDriverEditing) {
      setLocalDriverEditVal('');
      const savedRests = driver.defaultRestDays || [];
      setRestStartDay(savedRests[0] || '일');
      setSyncPartnerRest(hasPartnerInGroup);
      setTimeout(() => editNameInputRef.current?.focus(), 0);
    }
  }, [isDriverEditing, driver.defaultRestDays, hasPartnerInGroup]);

  const onConfirmBusEdit = () => {
    const ok = handleBusEditConfirmUI(bIdx, localBusEditVal);
    if (!ok) {
      editBusInputRef.current?.select();
      editBusInputRef.current?.focus();
    }
  };

  const onConfirmDriverEdit = () => {
    handleDriverEditConfirmUI(bIdx, dIdx, localDriverEditVal);
  };

  // ✨ 첫 요일 선택 시 연속된 뒷 요일을 자동으로 계산해 2일 휴무쌍(예: '일' ➔ ['일', '월'], '토' ➔ ['토', '일'])으로 저장
  const onConfirmDefaultRest = () => {
    const firstIdx = DOW_OPTIONS.indexOf(restStartDay);
    const validFirstIdx = firstIdx >= 0 ? firstIdx : 0;
    const secondDay = DOW_OPTIONS[(validFirstIdx + 1) % 7];
    const restPair = [DOW_OPTIONS[validFirstIdx], secondDay];

    handleDefaultRestSaveUI?.(bIdx, dIdx, restPair, syncPartnerRest && hasPartnerInGroup);
    setEditingDriver(null);
  };

  const previewSecondDay = useMemo(() => {
    const idx = DOW_OPTIONS.indexOf(restStartDay);
    return DOW_OPTIONS[((idx >= 0 ? idx : 0) + 1) % 7];
  }, [restStartDay]);

  const isPrivate = routeType === 'PRIVATE';
  const maxShiftCount = routeInfo?.weekdayCount || maxDriverOrder || 50;
  const effectiveAlign = nameAlign || (dIdx === 0 ? 'left' : 'right');

  const borderBottomClass = isLastInGroup
    ? 'border-b-[2.5px] border-b-slate-700'
    : 'border-b border-b-slate-200';

  const mergedCellBorderClass =
    busGroup.drivers.length > 1 ? 'border-b-[2.5px] border-b-slate-700' : borderBottomClass;

  const isBlankDriver = !driver.name || driver.name.trim() === '';
  const hasAnySchedule = Object.values(driver.schedules || {}).some(v => v && v.trim() !== '');
  const isCompletelyEmptySlot = isBlankDriver && !hasAnySchedule;

  const trimmedQuery = searchQuery.trim();
  const isDriverMatchedBySearch =
    trimmedQuery !== '' &&
    !isBlankDriver &&
    (driver.name.includes(trimmedQuery) || busGroup.busNo.includes(trimmedQuery));

  const trClass = `${
    isDriverMatchedBySearch ? 'bg-indigo-50/70' : 'hover:bg-slate-100/50'
  } group ${borderBottomClass} h-[34px]`;

  const rowStats = useMemo(() => {
    if (passedRowStats) return passedRowStats;
    return calculateRowStats(
      driver,
      year,
      month,
      daysArray,
      holidays,
      hourlyWage,
      routeType,
      prevMonthLastDayWork,
      allRoutes,
      maxShiftCount
    );
  }, [
    passedRowStats,
    driver,
    year,
    month,
    daysArray,
    holidays,
    hourlyWage,
    routeType,
    prevMonthLastDayWork,
    allRoutes,
    maxShiftCount,
  ]);

  const longShiftStats = useMemo(() => {
    if (isPrivate || !showLongShifts || sortedLongShifts.length === 0) {
      return { counts: {} as Record<string, number>, sum: 0 };
    }
    const counts: Record<string, number> = {};
    let sum = 0;
    sortedLongShifts.forEach(shift => {
      let c = 0;
      for (let i = 0; i < daysArray.length; i++) {
        if (driver.schedules[String(daysArray[i])] === shift) c++;
      }
      counts[shift] = c;
      sum += c;
    });
    return { counts, sum };
  }, [isPrivate, showLongShifts, sortedLongShifts, daysArray, driver.schedules]);

  const isDeficientWorkDays =
    !isPrivate && !isCompletelyEmptySlot && rowStats.totalWorkDays < rowStats.targetSojeong;

  const isModalActive = !!scheduleModalObj;
  const generalDimClass = isModalActive ? 'opacity-20' : '';

  const targetBIdx = scheduleModalObj?.bIdx ?? -1;
  const targetDIdx = scheduleModalObj?.dIdx ?? -1;
  const targetDay = scheduleModalObj?.day ?? -1;

  const isTargetDriver = targetBIdx === bIdx && targetDIdx === dIdx;
  const tdDimClass = isModalActive && !isTargetDriver ? 'opacity-20' : '';

  const tdActiveClass = isTargetDriver
    ? 'ring-[3px] ring-blue-500 shadow-[0_0_20px_5px_rgba(59,130,246,0.8)] scale-[1.15] bg-white z-[201] relative rounded-lg overflow-visible'
    : isDriverMatchedBySearch
    ? 'bg-indigo-100 text-indigo-900 ring-2 ring-indigo-500 ring-inset'
    : 'bg-white group-hover:bg-slate-50 shadow-[inset_-2px_0_0_#cbd5e1,2px_0_5px_-2px_rgba(0,0,0,0.05)]';

  const alignClass =
    effectiveAlign === 'left' ? 'text-left pl-1.5 pr-0.5' : 'text-right pr-1.5 pl-0.5';

  const handleBusCellClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isModalActive) {
      setActiveMenuIndex(null);
      setEditingBusIndex(null);
      return;
    }
    if ((e.target as HTMLElement).closest('.row-menu')) return;
    if (isMenuActive) {
      setActiveMenuIndex(null);
      setEditingBusIndex(null);
    } else {
      setTimeout(() => {
        setActiveMenuIndex({ bIdx, dIdx });
        setEditingBusIndex(null);
        setEditingDriver(null);
      }, 0);
    }
  };

  const busMenuPopover = isMenuActive && (
    <div className="row-menu absolute left-[calc(100%+4px)] top-1/2 -translate-y-1/2 bg-slate-800 text-white shadow-xl rounded-lg flex flex-col p-1 z-[100] border border-slate-700 whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
      <div className="flex items-center gap-0.5">
        <button
          onClick={e => {
            e.stopPropagation();
            moveRowUp(bIdx);
            setActiveMenuIndex({ bIdx: bIdx - 1, dIdx });
          }}
          disabled={bIdx === 0}
          className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
            bIdx === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-600 active:scale-95'
          }`}
        >
          <ArrowUp size={16} strokeWidth={3} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            handleRowDelete(bIdx);
          }}
          className="px-2.5 py-1.5 rounded-md font-bold text-[12px] hover:bg-red-500 transition-colors flex items-center justify-center active:scale-95"
        >
          삭제
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            setEditingBusIndex(bIdx);
          }}
          className="px-2.5 py-1.5 rounded-md font-bold text-[12px] hover:bg-blue-500 transition-colors flex items-center justify-center active:scale-95"
        >
          수정
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            moveRowDown(bIdx);
            setActiveMenuIndex({ bIdx: bIdx + 1, dIdx });
          }}
          disabled={bIdx === rosterDataLength - 1}
          className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
            bIdx === rosterDataLength - 1
              ? 'opacity-30 cursor-not-allowed'
              : 'hover:bg-slate-600 active:scale-95'
          }`}
        >
          <ArrowDown size={16} strokeWidth={3} />
        </button>
      </div>
      {editingBusIndex === bIdx && (
        <div className="flex items-center gap-1.5 mt-1 p-1.5 bg-slate-900 rounded-lg border border-slate-600 animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="flex items-center justify-center bg-transparent border border-white text-white font-black text-[11px] px-2 py-1.5 rounded tracking-tighter select-none">
            수정
          </span>
          <input
            ref={editBusInputRef}
            type="text"
            value={localBusEditVal}
            onChange={e => setLocalBusEditVal(e.target.value)}
            className="w-[60px] bg-slate-800 border border-slate-500 rounded px-2 py-1.5 font-bold text-white text-[13px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onConfirmBusEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setEditingBusIndex(null);
                setActiveMenuIndex(null);
              }
            }}
            autoFocus
          />
          <button
            onClick={e => {
              e.stopPropagation();
              setEditingBusIndex(null);
              setActiveMenuIndex(null);
            }}
            className="bg-slate-600 text-white font-bold px-2.5 py-1.5 rounded text-[13px] hover:bg-slate-500 active:scale-95 transition-all"
          >
            취소
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              onConfirmBusEdit();
            }}
            className="bg-blue-600 text-white font-bold px-2.5 py-1.5 rounded text-[13px] hover:bg-blue-700 active:scale-95 transition-all"
          >
            확인
          </button>
        </div>
      )}
    </div>
  );

  const defaultRestDisplay = isBlankDriver
    ? ''
    : driver.defaultRestDays && driver.defaultRestDays.length === 2
    ? driver.defaultRestDays.join('')
    : '-';

  return (
    <tr className={trClass}>
      {isPrivate ? (
        <td
          className={`sticky left-0 z-30 bg-slate-100 text-center font-black text-slate-700 text-[14px] align-middle px-0.5 shadow-[inset_2.5px_0_0_#334155,inset_-1px_0_0_#94a3b8,inset_-1px_0_3px_rgba(0,0,0,0.02)] ${borderBottomClass} ${generalDimClass}`}
        >
          {dIdx === 0 ? 'A' : 'B'}
        </td>
      ) : (
        dIdx === 0 && (
          <td
            rowSpan={busGroup.drivers.length}
            className={`sticky left-0 z-30 bg-slate-100 text-center font-black text-slate-700 text-[14px] align-middle px-0.5 shadow-[inset_2.5px_0_0_#334155,inset_-1px_0_0_#94a3b8,inset_-1px_0_3px_rgba(0,0,0,0.02)] ${mergedCellBorderClass} ${generalDimClass}`}
          >
            {busGroup.displayNo}
          </td>
        )
      )}

      {isPrivate ? (
        <td
          onClick={handleBusCellClick}
          className={`sticky left-[32px] ${
            isMenuActive
              ? 'z-[60] bg-blue-100 ring-2 ring-blue-500 ring-inset'
              : 'z-30 bg-slate-50 hover:bg-slate-200'
          } cursor-pointer ${alignClass} font-black text-slate-700 text-[14px] align-middle tracking-tighter shadow-[inset_-1px_0_0_#cbd5e1,1px_0_3px_rgba(0,0,0,0.05)] ${borderBottomClass} ${generalDimClass}`}
        >
          {busGroup.busNo}
          {busMenuPopover}
        </td>
      ) : (
        dIdx === 0 && (
          <td
            rowSpan={busGroup.drivers.length}
            onClick={handleBusCellClick}
            className={`sticky left-[32px] ${
              isMenuActive
                ? 'z-[60] bg-blue-100 ring-2 ring-blue-500 ring-inset'
                : 'z-30 bg-slate-50 hover:bg-slate-200'
            } cursor-pointer text-center font-black text-slate-700 text-[14px] align-middle px-0.5 tracking-tighter shadow-[inset_-1px_0_0_#cbd5e1,1px_0_3px_rgba(0,0,0,0.05)] ${mergedCellBorderClass} ${generalDimClass}`}
          >
            {busGroup.busNo}
            {busMenuPopover}
          </td>
        )
      )}

      <td
        className={`sticky left-[78px] ${alignClass} py-1 font-extrabold text-slate-900 text-[14px] align-middle tracking-tight cursor-pointer ${
          isDriverEditing
            ? 'z-[60] bg-blue-100 ring-2 ring-blue-500 ring-inset overflow-visible'
            : 'z-30'
        } ${borderBottomClass} ${tdDimClass} ${tdActiveClass}`}
        onClick={e => {
          e.stopPropagation();
          if (isModalActive) {
            setEditingDriver(null);
            return;
          }
          if ((e.target as HTMLElement).closest('.name-edit-popover')) return;
          setTimeout(() => {
            setEditingDriver({ bIdx, dIdx });
            setActiveMenuIndex(null);
          }, 0);
        }}
      >
        {driver.name}
        {isDriverEditing && (
          <div
            onClick={e => e.stopPropagation()}
            className="name-edit-popover absolute left-[calc(100%+4px)] top-1/2 -translate-y-1/2 bg-slate-800 text-white shadow-2xl rounded-xl flex flex-col gap-2 p-2.5 z-[100] border border-slate-700 whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="flex items-center gap-1.5">
              <input
                ref={editNameInputRef}
                type="text"
                value={localDriverEditVal}
                onChange={e => setLocalDriverEditVal(e.target.value)}
                placeholder={driver.name || '성명 입력'}
                className="w-[82px] bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 font-bold text-white text-[13px] placeholder:text-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onConfirmDriverEdit();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditingDriver(null);
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setEditingDriver(null);
                }}
                className="bg-slate-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-[13px] hover:bg-slate-500 active:scale-95 transition-all"
              >
                취소
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onConfirmDriverEdit();
                }}
                className="bg-blue-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-[13px] hover:bg-blue-700 active:scale-95 transition-all"
              >
                확인
              </button>
              <div className="w-[1px] h-5 bg-slate-600 mx-0.5" />
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  if (
                    window.confirm(
                      `${driver.name || '해당'} 기사님의 이번 달 전체 근무를 삭제하시겠습니까?`
                    )
                  ) {
                    handleClearDriverSchedulesUI?.(bIdx, dIdx);
                    setEditingDriver(null);
                  }
                }}
                title="이 기사님의 해당 월 전체 근무 삭제"
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[13px] active:scale-95 transition-all flex items-center gap-1"
              >
                <Trash2 size={13} strokeWidth={2.5} /> 삭제
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setEditingDriver(null);
                  onOpenShareModal?.(bIdx, dIdx);
                }}
                title="이 기사님의 월간 근무표 텍스트 복사/공유"
                className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-[13px] active:scale-95 transition-all flex items-center gap-1"
              >
                <Share2 size={13} strokeWidth={2.5} /> 공유
              </button>
            </div>

            {/* ✨ 2행: 기본휴무 단일 드롭다운 (첫 요일만 선택하면 연속된 뒷 요일이 자동 포함됨) */}
            {!isPrivate && (
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-700">
                <span className="flex items-center justify-center bg-slate-900 border border-emerald-400/70 text-emerald-300 font-black text-[12px] px-2.5 py-1.5 rounded-lg tracking-tight select-none">
                  기본휴무
                </span>
                <select
                  value={restStartDay}
                  onChange={e => setRestStartDay(e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 font-extrabold text-white text-[13px] focus:outline-none focus:border-emerald-400 cursor-pointer"
                >
                  {DOW_OPTIONS.map(dow => (
                    <option key={`r1-${dow}`} value={dow}>
                      {dow}
                    </option>
                  ))}
                </select>
                <span
                  className="px-2 py-1 rounded-md bg-slate-900/80 border border-slate-700 text-emerald-300 font-black text-[12px] select-none"
                  title="선택한 요일과 다음 요일이 연속 휴무로 자동 저장됩니다"
                >
                  {restStartDay}
                  {previewSecondDay}
                </span>

                {hasPartnerInGroup && (
                  <label className="flex items-center gap-1 px-1.5 py-1 rounded bg-slate-900/90 border border-slate-700 cursor-pointer select-none text-[11.5px] font-bold text-emerald-300">
                    <input
                      type="checkbox"
                      checked={syncPartnerRest}
                      onChange={e => setSyncPartnerRest(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
                    />
                    파트너 동시
                  </label>
                )}

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setEditingDriver(null);
                  }}
                  className="bg-slate-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-[13px] hover:bg-slate-500 active:scale-95 transition-all ml-auto"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onConfirmDefaultRest();
                  }}
                  className="bg-emerald-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-[13px] hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  확인
                </button>
              </div>
            )}
          </div>
        )}
      </td>

      {!isPrivate && showLongShifts && (
        <td
          className={`w-[44px] min-w-[44px] max-w-[44px] text-center py-1 border-r-[2px] border-r-slate-500 bg-emerald-50/70 font-black text-emerald-900 text-[14px] align-middle ${borderBottomClass} ${generalDimClass}`}
        >
          {defaultRestDisplay}
        </td>
      )}

      {daysArray.map(day => {
        const dayType = getDayType(year, month, day, holidays);
        const work = (driver.schedules[String(day)] || '').trim();
        const warningsForDay = cellWarnings[day] || [];
        const hasPublicWarning = !isPrivate && warningsForDay.length > 0;
        const isTodayCol = todayDay === day;

        let tdBgClass = isTodayCol ? 'bg-blue-50/40' : 'bg-white';
        if (dayType === 'JEOLNAL') tdBgClass = 'bg-red-50';
        else if (dayType === 'SUN') tdBgClass = 'bg-slate-100';
        else if (dayType === 'SAT') tdBgClass = 'bg-slate-50';

        const isTargetDate = targetDay === day;
        const isActiveCell = isTargetDate && isTargetDriver;
        const currentRowIdx = bIdx * 100 + dIdx;
        const targetRowIdx = targetBIdx * 100 + targetDIdx;

        const isGuideRow = isTargetDriver && day < targetDay;
        const isGuideCol = isTargetDate && currentRowIdx < targetRowIdx;
        const isGuideCell = isGuideRow || isGuideCol;

        let textColor = 'text-slate-900';
        let fontWeightClass = 'font-black text-[18px]';
        let hasPrivateWarning = false;

        const isRegularPrivateShift =
          isPrivate && isNormalPrivateShift(work, allRoutes, maxShiftCount);

        if (isRegularPrivateShift) {
          const num = Number(work);
          const isDuplicate = duplicateShifts[day]?.includes(work);
          const isSatDrop = dayType === 'SAT' && routeInfo?.satDrops?.includes(num);
          const isSunDrop =
            (dayType === 'SUN' || dayType === 'JEOLNAL') && routeInfo?.sunDrops?.includes(num);

          const baseWork = driver.baseSchedules?.[String(day)];
          const isDefault = baseWork !== undefined && baseWork === work;

          fontWeightClass = isDefault ? 'font-normal text-[18px]' : 'font-black text-[18px]';

          if (isDuplicate || isSatDrop || isSunDrop) {
            textColor = 'text-red-600';
            fontWeightClass = 'font-black text-[18px]';
            hasPrivateWarning = true;
          }
        }

        const isWorked = (w: string) => isPrivateWorkDay(w, allRoutes, maxShiftCount);
        let isPrevWorked = false;
        let isNextWorked = false;

        if (isPrivate && isWorked(work)) {
          const prevW = day === 1 ? prevMonthLastDayWork : driver.schedules[String(day - 1)] || '';
          const nextW =
            day === daysArray.length
              ? nextMonthFirstDayWork
              : driver.schedules[String(day + 1)] || '';

          isPrevWorked = isWorked(prevW);
          isNextWorked = isWorked(nextW);
        }

        const isBokgyeokCell = isPrevWorked || isNextWorked;
        const anyWarning = hasPublicWarning || hasPrivateWarning || isBokgyeokCell;

        let isFilterMatch = true;
        if (highlightFilter !== 'ALL' || trimmedQuery !== '') {
          if (highlightFilter === 'WARNING') {
            isFilterMatch = anyWarning;
          } else if (highlightFilter === 'LEAVE') {
            isFilterMatch = work === '연차' || work === '연';
          } else if (highlightFilter === 'REST') {
            isFilterMatch = work === '신청휴무';
          } else if (highlightFilter === 'AM') {
            isFilterMatch = work.includes('전');
          } else if (highlightFilter === 'PM') {
            isFilterMatch = work.includes('후');
          }

          if (trimmedQuery !== '' && !isDriverMatchedBySearch) {
            isFilterMatch = isFilterMatch && work !== '' && work.includes(trimmedQuery);
          }
        }

        const filterDimClass =
          !isModalActive && (highlightFilter !== 'ALL' || trimmedQuery !== '') && !isFilterMatch
            ? 'opacity-20'
            : '';

        const cellDimClass =
          isModalActive && !isActiveCell && !isGuideCell ? 'opacity-20' : filterDimClass;

        let content;
        if (!work) {
          content = isBlankDriver ? null : <span className="text-slate-300">-</span>;
        } else if (work === '신청휴무') {
          content = (
            <span
              className={`font-black text-[22px] flex items-center justify-center leading-none ${
                isActiveCell ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              X
            </span>
          );
        } else if (isRegularPrivateShift) {
          content = <span className={`${fontWeightClass} ${textColor}`}>{work}</span>;
        } else {
          const isStandardPill =
            work.includes('전') || work.includes('후') || work === '연차' || work === '연';
          let fontSizeClass = 'text-[13px]';
          if (!isStandardPill) {
            if (work.length <= 2) fontSizeClass = 'text-[15px]';
            else if (work.length === 3) fontSizeClass = 'text-[13px] tracking-tight';
            else fontSizeClass = 'text-[11.5px] tracking-tighter';
          }

          let pillClass = `m-auto w-[37px] h-[31px] font-black rounded-[4px] ${fontSizeClass} leading-none shadow-sm border flex items-center justify-center px-0.5 overflow-hidden relative `;
          if (hasPublicWarning) {
            pillClass += 'ring-[2px] ring-red-600 ring-offset-0 ';
          }
          if (work.includes('전')) {
            pillClass += 'bg-orange-500 border-orange-600 text-white';
          } else if (work.includes('후')) {
            pillClass += 'bg-blue-500 border-blue-600 text-white';
          } else if (work === '연차' || work === '연') {
            pillClass += 'bg-purple-400 border-purple-500 text-white';
          } else {
            pillClass += 'bg-emerald-600 border-emerald-700 text-white';
          }

          const tooltipText =
            warningsForDay.length > 0 ? `[주의] ${warningsForDay.join(' / ')}` : work;

          content = (
            <span className={pillClass} title={tooltipText}>
              {work}
              {hasPublicWarning && (
                <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-600 text-white text-[9px] font-black flex items-center justify-center rounded-bl-[4px] shadow">
                  !
                </span>
              )}
            </span>
          );
        }

        return (
          <td
            key={day}
            onClick={e => {
              e.stopPropagation();
              if (isModalActive) {
                setScheduleModalObj(null);
              } else {
                setScheduleModalObj({ bIdx, dIdx, day, dayType });
              }
            }}
            className={`w-[40px] min-w-[40px] max-w-[40px] text-center p-0 border-r border-slate-200 align-middle cursor-pointer relative ${
              isActiveCell
                ? 'z-[200] bg-white ring-[3px] ring-blue-500 shadow-[0_0_20px_5px_rgba(59,130,246,0.8)] scale-[1.15] rounded-lg overflow-visible'
                : isGuideCell
                ? `z-[195] ${tdBgClass} ${borderBottomClass}`
                : `z-10 ${!isModalActive ? 'hover:bg-blue-50' : ''} ${tdBgClass} ${borderBottomClass} ${cellDimClass}`
            }`}
          >
            {isBokgyeokCell && !isActiveCell && !isGuideCell && (
              <div
                className={`absolute inset-y-[2px] pointer-events-none border-red-500 z-20 border-y-[1.5px] ${
                  !isPrevWorked
                    ? 'left-[2px] border-l-[1.5px] rounded-l-[6px]'
                    : 'left-[-1px] border-l-0'
                } ${
                  !isNextWorked
                    ? 'right-[2px] border-r-[1.5px] rounded-r-[6px]'
                    : 'right-[-1px] border-r-0'
                }`}
              />
            )}

            {hasPublicWarning && !isActiveCell && !isGuideCell && (
              <div className="absolute inset-[1px] pointer-events-none border-[2px] border-red-600 rounded-[5px] z-20" />
            )}

            {isGuideCell && (
              <>
                <div className="absolute inset-0 bg-slate-800/70 z-10 pointer-events-none" />
                {isGuideRow && (
                  <div className="absolute top-1/2 left-0 w-[calc(100%+2px)] h-[3px] bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,1)] -translate-y-1/2 z-20 pointer-events-none" />
                )}
                {isGuideCol && (
                  <div className="absolute left-1/2 top-0 h-[calc(100%+2px)] w-[3px] bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,1)] -translate-x-1/2 z-20 pointer-events-none" />
                )}
              </>
            )}
            <div
              className={`relative flex items-center justify-center w-full h-full ${
                isActiveCell ? 'z-30' : 'z-0'
              } ${isGuideCell ? 'opacity-30' : ''}`}
            >
              {content}
            </div>
          </td>
        );
      })}

      {isPrivate ? (
        <>
          <td
            className={`w-[42px] min-w-[42px] text-center py-1 border-l-[2.5px] border-l-slate-700 border-r border-slate-200 bg-slate-50 align-middle shadow-[inset_1px_0_2px_rgba(0,0,0,0.05)] ${borderBottomClass} ${generalDimClass}`}
          >
            <span className="font-black text-slate-800 text-[15px]">
              {isCompletelyEmptySlot ? '' : rowStats.totalWorkDays}
            </span>
          </td>

          <td
            className={`w-[42px] min-w-[42px] text-center py-1 border-r border-rose-100 bg-rose-50/50 font-black text-rose-600 text-[15px] ${borderBottomClass} ${generalDimClass}`}
          >
            {isCompletelyEmptySlot ? '' : rowStats.jeolnalTotal}
          </td>

          <td
            className={`w-[42px] min-w-[42px] text-center py-1 border-r-[2.5px] border-r-slate-700 bg-purple-50/50 font-black text-purple-700 text-[15px] ${borderBottomClass} ${generalDimClass}`}
          >
            {isCompletelyEmptySlot ? '' : rowStats.bokgyeokCount}
          </td>

          <td
            className={`w-[85px] min-w-[85px] text-center py-1 bg-slate-50 align-middle ${borderBottomClass} ${generalDimClass}`}
          >
            <span className="font-black text-slate-900 text-[14.5px] tracking-tight">
              {isCompletelyEmptySlot ? '' : rowStats.expectedSalary.toLocaleString()}
            </span>
          </td>
        </>
      ) : (
        <>
          <td
            className={`w-[42px] min-w-[42px] text-center py-1 border-l-[2.5px] border-l-slate-700 border-r border-slate-200 bg-slate-50 align-middle shadow-[inset_1px_0_2px_rgba(0,0,0,0.05)] ${borderBottomClass} ${generalDimClass}`}
          >
            {isCompletelyEmptySlot ? (
              ''
            ) : isDeficientWorkDays ? (
              <span className="inline-flex items-center justify-center min-w-[28px] h-[24px] bg-red-50 text-red-600 ring-[2px] ring-red-500 rounded font-black text-[15px] shadow-sm">
                {rowStats.totalWorkDays}
              </span>
            ) : (
              <span className="font-black text-slate-800 text-[15px]">{rowStats.totalWorkDays}</span>
            )}
          </td>
          <td
            className={`w-[36px] min-w-[36px] text-center py-1 border-r border-orange-100 bg-orange-50/40 font-black text-orange-700 text-[15px] ${borderBottomClass} ${generalDimClass}`}
          >
            {isCompletelyEmptySlot ? '' : rowStats.amCount || 0}
          </td>
          <td
            className={`w-[36px] min-w-[36px] text-center py-1 border-r-[2.5px] border-r-slate-700 bg-blue-50/50 font-black text-blue-700 text-[15px] ${borderBottomClass} ${generalDimClass}`}
          >
            {isCompletelyEmptySlot ? '' : rowStats.pmCount || 0}
          </td>

          <td
            className={`w-[42px] min-w-[42px] text-center py-1 border-r border-emerald-200 bg-emerald-100/70 font-black text-emerald-950 text-[15px] ${borderBottomClass} ${generalDimClass}`}
          >
            {isCompletelyEmptySlot ? '' : rowStats.targetSojeong}
          </td>
          <td
            className={`w-[42px] min-w-[42px] text-center py-1 border-r-[2.5px] border-r-slate-700 bg-emerald-50/60 font-black text-emerald-900 text-[14.5px] ${borderBottomClass} ${generalDimClass}`}
          >
            {isCompletelyEmptySlot ? '' : rowStats.fixedRestsStr}
          </td>
          <td
            className={`w-[42px] min-w-[42px] text-center py-1 border-r border-rose-100 bg-rose-50/50 font-black text-rose-600 text-[15px] ${borderBottomClass} ${generalDimClass}`}
          >
            {isCompletelyEmptySlot ? '' : rowStats.jeolnalTotal}
          </td>
          <td
            className={`w-[42px] min-w-[42px] text-center py-1 border-r border-orange-100 bg-orange-50/40 font-black text-orange-600 text-[15px] ${borderBottomClass} ${generalDimClass}`}
          >
            {isCompletelyEmptySlot ? '' : rowStats.overtimeDays}
          </td>
          <td
            className={`w-[42px] min-w-[42px] text-center py-1 border-r-[2.5px] border-r-slate-700 bg-red-50/60 font-black text-red-700 text-[15px] ${borderBottomClass} ${generalDimClass}`}
          >
            {isCompletelyEmptySlot ? '' : rowStats.extraTotal}
          </td>

          <td
            className={`w-[85px] min-w-[85px] text-center py-1 bg-slate-50 align-middle ${borderBottomClass} ${generalDimClass}`}
          >
            {(() => {
              if (isCompletelyEmptySlot) return '';
              const salary = rowStats.expectedSalary;
              if (salary === 0)
                return <span className="font-black text-slate-900 text-[14.5px]">0</span>;
              if (salary === maxSalary)
                return (
                  <span className="inline-flex whitespace-nowrap px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md font-black text-[13.5px] shadow-sm tracking-tight">
                    {salary.toLocaleString()}
                  </span>
                );
              if (salary === minSalary)
                return (
                  <span className="inline-flex whitespace-nowrap px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-md font-black text-[13.5px] shadow-sm tracking-tight">
                    {salary.toLocaleString()}
                  </span>
                );
              return (
                <span className="font-black text-slate-900 text-[14.5px] tracking-tight">
                  {salary.toLocaleString()}
                </span>
              );
            })()}
          </td>

          {showLongShifts && sortedLongShifts.length > 0 && (
            <>
              {sortedLongShifts.map((shift, idx) => {
                const count = longShiftStats.counts[shift] || 0;
                return (
                  <td
                    key={shift}
                    className={`w-[36px] min-w-[36px] text-center py-1 border-r border-amber-100 bg-amber-50/50 font-black text-amber-700 text-[15px] ${
                      idx === 0 ? 'border-l-[2.5px] border-l-slate-700' : ''
                    } ${borderBottomClass} ${generalDimClass}`}
                  >
                    {isCompletelyEmptySlot ? '' : count > 0 ? count : 0}
                  </td>
                );
              })}
              <td
                className={`w-[42px] min-w-[42px] text-center py-1 border-r-[2.5px] border-r-slate-700 bg-amber-200 text-amber-950 font-extrabold text-[13px] align-middle leading-tight text-center ${borderBottomClass} ${generalDimClass}`}
              >
                {isCompletelyEmptySlot ? '' : longShiftStats.sum}
              </td>
            </>
          )}
        </>
      )}
    </tr>
  );
}

const RosterTableRow = React.memo(RosterTableRowComponent);
export default RosterTableRow;