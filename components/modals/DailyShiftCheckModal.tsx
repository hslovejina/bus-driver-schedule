// 파일 위치: components/modals/DailyShiftCheckModal.tsx
'use client';

import React, { useMemo } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  SearchCheck,
  CalendarDays,
  ArrowUpRight,
} from 'lucide-react';
import { getDayType, isNormalPrivateShift } from '../../utils/calculator';
import type { BusGroup } from '../../hooks/useRosterData';

interface Props {
  isOpen: boolean;
  day: number | null;
  focusType?: 'AM' | 'PM' | 'TOTAL';
  year: number;
  month: number;
  holidays: Record<string, string>;
  routeInfo: any;
  allRoutes: { name: string; routeType: string }[];
  maxShiftCount: number;
  rosterData: BusGroup[];
  isPrivate: boolean;
  onClose: () => void;
  onOpenCellModal: (bIdx: number, dIdx: number, day: number, dayType: string) => void;
}

interface HolderItem {
  bIdx: number;
  dIdx: number;
  name: string;
  busNo: string;
  currentWork: string;
}

interface MissingShiftItem {
  shiftText: string;
  baseHolders: HolderItem[];
}

interface DuplicateShiftItem {
  shiftText: string;
  holders: HolderItem[];
}

interface DroppedAssignedItem {
  shiftText: string;
  holders: HolderItem[];
}

const DOW_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function DailyShiftCheckModal({
  isOpen,
  day,
  focusType = 'TOTAL',
  year,
  month,
  holidays,
  routeInfo,
  allRoutes,
  maxShiftCount,
  rosterData,
  isPrivate,
  onClose,
  onOpenCellModal,
}: Props) {
  const analysis = useMemo(() => {
    if (!day) return null;

    const dayType = getDayType(year, month, day, holidays);
    const dow = DOW_NAMES[new Date(year, month - 1, day).getDay()];
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const holidayName = holidays[dateStr];

    let drops: number[] = [];
    if (dayType === 'SAT') drops = routeInfo?.satDrops || [];
    else if (dayType === 'SUN' || dayType === 'JEOLNAL') drops = routeInfo?.sunDrops || [];

    const totalCount = routeInfo?.weekdayCount || maxShiftCount || 1;
    const expectedPerShift = Math.max(0, totalCount - drops.length);

    const actualHoldersMap: Record<string, HolderItem[]> = {};
    const baseHoldersMap: Record<string, HolderItem[]> = {};

    let leaveCount = 0;
    let restRequestCount = 0;

    rosterData.forEach((group, bIdx) => {
      const busNo = group.busNo.trim();
      group.drivers.forEach((drv, dIdx) => {
        const name = drv.name?.trim() || '';
        if (!name) return;

        const currentWork = (drv.schedules?.[String(day)] || '').trim();
        const baseWork = (drv.baseSchedules?.[String(day)] || '').trim();

        if (currentWork === '연차' || currentWork === '연') leaveCount++;
        if (currentWork === '신청휴무' || currentWork === 'x' || currentWork === 'X') restRequestCount++;

        if (currentWork) {
          if (isPrivate) {
            if (isNormalPrivateShift(currentWork, allRoutes, totalCount)) {
              const key = String(parseInt(currentWork, 10));
              actualHoldersMap[key] = [
                ...(actualHoldersMap[key] || []),
                { bIdx, dIdx, name, busNo, currentWork },
              ];
            }
          } else {
            const m = currentWork.match(/^(전|후)(\d+)$/);
            if (m) {
              const key = `${m[1]}${parseInt(m[2], 10)}`;
              actualHoldersMap[key] = [
                ...(actualHoldersMap[key] || []),
                { bIdx, dIdx, name, busNo, currentWork },
              ];
            }
          }
        }

        if (baseWork) {
          if (isPrivate) {
            if (isNormalPrivateShift(baseWork, allRoutes, totalCount)) {
              const key = String(parseInt(baseWork, 10));
              baseHoldersMap[key] = [
                ...(baseHoldersMap[key] || []),
                { bIdx, dIdx, name, busNo, currentWork },
              ];
            }
          } else {
            const m = baseWork.match(/^(전|후)(\d+)$/);
            if (m) {
              const key = `${m[1]}${parseInt(m[2], 10)}`;
              baseHoldersMap[key] = [
                ...(baseHoldersMap[key] || []),
                { bIdx, dIdx, name, busNo, currentWork },
              ];
            }
          }
        }
      });
    });

    const checkPrefixGroup = (prefix: '전' | '후' | '') => {
      const missing: MissingShiftItem[] = [];
      const duplicates: DuplicateShiftItem[] = [];
      const droppedAssigned: DroppedAssignedItem[] = [];
      let assignedCount = 0;

      for (let s = 1; s <= totalCount; s++) {
        const key = `${prefix}${s}`;
        const holders = actualHoldersMap[key] || [];
        const isDropped = drops.includes(s);

        assignedCount += holders.length;

        if (isDropped) {
          if (holders.length > 0) {
            droppedAssigned.push({ shiftText: key, holders });
          }
        } else {
          if (holders.length === 0) {
            missing.push({
              shiftText: key,
              baseHolders: baseHoldersMap[key] || [],
            });
          } else if (holders.length > 1) {
            duplicates.push({ shiftText: key, holders });
          }
        }
      }

      return { missing, duplicates, droppedAssigned, assignedCount };
    };

    const amResult = isPrivate ? checkPrefixGroup('') : checkPrefixGroup('전');
    const pmResult = isPrivate
      ? { missing: [], duplicates: [], droppedAssigned: [], assignedCount: 0 }
      : checkPrefixGroup('후');

    return {
      dayType,
      dow,
      holidayName,
      drops,
      totalCount,
      expectedPerShift,
      leaveCount,
      restRequestCount,
      amResult,
      pmResult,
    };
  }, [day, year, month, holidays, routeInfo, allRoutes, maxShiftCount, rosterData, isPrivate]);

  if (!isOpen || !day || !analysis) return null;

  const {
    dayType,
    dow,
    holidayName,
    drops,
    expectedPerShift,
    leaveCount,
    restRequestCount,
    amResult,
    pmResult,
  } = analysis;

  const dayTypeLabel =
    dayType === 'JEOLNAL'
      ? `공휴일(${holidayName || '절날'})`
      : dayType === 'SUN'
      ? '일요일'
      : dayType === 'SAT'
      ? '토요일'
      : '평일';

  const renderSection = (
    title: string,
    theme: 'ORANGE' | 'BLUE',
    result: typeof amResult
  ) => {
    const isOk =
      result.missing.length === 0 &&
      result.duplicates.length === 0 &&
      result.droppedAssigned.length === 0 &&
      result.assignedCount === expectedPerShift;

    const badgeBg =
      theme === 'ORANGE'
        ? 'bg-orange-500 text-white'
        : 'bg-blue-600 text-white';
    const headerBorder =
      theme === 'ORANGE' ? 'border-orange-200 bg-orange-50/60' : 'border-blue-200 bg-blue-50/60';

    return (
      <div className={`rounded-2xl border ${headerBorder} p-4 flex flex-col gap-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg font-black text-[13px] ${badgeBg}`}>
              {title}
            </span>
            <span className="font-extrabold text-[14px] text-slate-700">
              배정 <strong className="text-slate-950">{result.assignedCount}</strong> / 기준{' '}
              <strong className="text-slate-950">{expectedPerShift}</strong>대
            </span>
          </div>

          {isOk ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
              <CheckCircle2 size={14} strokeWidth={2.5} /> 정상 완료
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] font-black text-red-600 bg-red-100 px-2.5 py-1 rounded-full">
              <AlertTriangle size={14} strokeWidth={2.5} /> 점검 필요
            </span>
          )}
        </div>

        {isOk ? (
          <p className="text-[13px] font-bold text-slate-500 py-1">
            누락이나 중복, 감차 오배정 없이 모든 순번이 정확하게 배정되었습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {/* 1. 미배정(누락) 순번 */}
            {result.missing.length > 0 && (
              <div className="bg-white rounded-xl p-3 border border-red-200 shadow-xs">
                <div className="text-[12.5px] font-black text-red-600 mb-2 flex items-center justify-between">
                  <span>❌ 미배정(누락) 순번 ({result.missing.length}건)</span>
                  <span className="text-[11px] font-bold text-slate-400">
                    클릭 시 해당 기사 칸으로 이동
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.missing.map(item => (
                    <div
                      key={item.shiftText}
                      className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-2.5 py-1.5"
                    >
                      <span className="font-black text-[14px] text-red-700">
                        {isPrivate ? `${item.shiftText}번` : item.shiftText}
                      </span>
                      {item.baseHolders.length > 0 ? (
                        item.baseHolders.map((bh, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenCellModal(bh.bIdx, bh.dIdx, day, dayType);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-indigo-600 text-slate-700 hover:text-white border border-red-200 hover:border-indigo-600 rounded-lg text-[12px] font-extrabold transition-colors cursor-pointer"
                            title="클릭하여 이 기사님의 근무 수정 또는 대체자 배정"
                          >
                            <span>
                              원담당: {bh.name}({bh.busNo})
                            </span>
                            <span className="text-[11px] opacity-80">
                              [{bh.currentWork || '빈칸'}]
                            </span>
                            <ArrowUpRight size={12} />
                          </button>
                        ))
                      ) : (
                        <span className="text-[11.5px] font-bold text-slate-400">
                          (원담당 기록 없음)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. 중복 배정 순번 */}
            {result.duplicates.length > 0 && (
              <div className="bg-white rounded-xl p-3 border border-amber-300 shadow-xs">
                <div className="text-[12.5px] font-black text-amber-700 mb-2">
                  ⚠️ 중복 배정 순번 ({result.duplicates.length}건)
                </div>
                <div className="flex flex-col gap-2">
                  {result.duplicates.map(item => (
                    <div
                      key={item.shiftText}
                      className="flex flex-wrap items-center gap-1.5 bg-amber-50/80 border border-amber-200 rounded-xl px-2.5 py-1.5"
                    >
                      <span className="font-black text-[14px] text-amber-800 mr-1">
                        {isPrivate ? `${item.shiftText}번` : item.shiftText}
                      </span>
                      {item.holders.map((h, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenCellModal(h.bIdx, h.dIdx, day, dayType);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-600 text-slate-800 hover:text-white border border-amber-300 hover:border-indigo-600 rounded-lg text-[12px] font-extrabold transition-colors cursor-pointer shadow-2xs"
                        >
                          <span>
                            {h.name} ({h.busNo})
                          </span>
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. 감차 순번 오배정 */}
            {result.droppedAssigned.length > 0 && (
              <div className="bg-white rounded-xl p-3 border border-purple-200 shadow-xs">
                <div className="text-[12.5px] font-black text-purple-700 mb-2">
                  🚫 감차 순번 배정됨 ({result.droppedAssigned.length}건)
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.droppedAssigned.map(item => (
                    <div
                      key={item.shiftText}
                      className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-xl px-2.5 py-1.5"
                    >
                      <span className="font-black text-[13.5px] text-purple-800 line-through">
                        {isPrivate ? `${item.shiftText}번` : item.shiftText}
                      </span>
                      {item.holders.map((h, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenCellModal(h.bIdx, h.dIdx, day, dayType);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-purple-600 text-slate-800 hover:text-white border border-purple-200 rounded-lg text-[12px] font-extrabold transition-colors cursor-pointer"
                        >
                          <span>
                            {h.name}({h.busNo})
                          </span>
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[360] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[88vh] border border-slate-200 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
              <SearchCheck size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[19px] font-black text-slate-800 tracking-tight leading-none">
                {month}월 {day}일({dow}) 순번 점검
              </h2>
              <p className="text-[13px] font-bold text-slate-500 mt-1.5 flex items-center gap-2">
                <span>{dayTypeLabel}</span>
                <span>·</span>
                <span>
                  {drops.length > 0
                    ? `감차 번호: ${drops.join(', ')}번`
                    : '감차 없음 (전 차량 운행)'}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4 bg-white">
          {isPrivate ? (
            renderSection('일일 순번', 'BLUE', amResult)
          ) : (
            <>
              {(focusType === 'TOTAL' || focusType === 'AM') &&
                renderSection('오전 (전)', 'ORANGE', amResult)}
              {(focusType === 'TOTAL' || focusType === 'PM') &&
                renderSection('오후 (후)', 'BLUE', pmResult)}
              {focusType !== 'TOTAL' && (
                <div className="pt-1">
                  {focusType === 'AM'
                    ? renderSection('오후 (후)', 'BLUE', pmResult)
                    : renderSection('오전 (전)', 'ORANGE', amResult)}
                </div>
              )}
            </>
          )}

          {/* 당일 휴무/연차 요약 */}
          <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[13px] font-bold text-slate-600">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={16} className="text-slate-400" /> 당일 휴무 현황
            </span>
            <div className="flex items-center gap-3">
              <span>
                🟣 연차: <strong className="text-purple-700">{leaveCount}명</strong>
              </span>
              <span>
                ❌ 신청휴무: <strong className="text-slate-800">{restRequestCount}명</strong>
              </span>
            </div>
          </div>
        </div>

        {/* 하단 닫기 */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-xl text-[15px] transition-all active:scale-95"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}