// 파일 위치: components/DailySummary.tsx
'use client';

import React from 'react';
import { getDayType } from '../utils/calculator';

interface Props {
  daysArray: number[];
  dailyStats: Record<number, { am: number; pm: number; total: number }>;
  routeInfo: any;
  year: number;
  month: number;
  holidays: Record<string, string>;
  showLongShifts: boolean;
  sortedLongShifts: string[];
  isPrivate: boolean;
  todayDay?: number | null;
  onCellClick?: (day: number, focusType: 'AM' | 'PM' | 'TOTAL') => void;
}

export default function DailySummary({
  daysArray,
  dailyStats,
  routeInfo,
  year,
  month,
  holidays,
  showLongShifts,
  sortedLongShifts,
  isPrivate,
  todayDay = null,
  onCellClick,
}: Props) {
  const getExpectedCount = (day: number) => {
    if (!routeInfo || !routeInfo.weekdayCount) return 0;
    const dayType = getDayType(year, month, day, holidays);
    let drops = 0;
    if (dayType === 'SAT' && routeInfo.satDrops) drops = routeInfo.satDrops.length;
    if ((dayType === 'SUN' || dayType === 'JEOLNAL') && routeInfo.sunDrops)
      drops = routeInfo.sunDrops.length;

    return Math.max(0, routeInfo.weekdayCount - drops);
  };

  const trailingColSpan =
    9 + (showLongShifts && sortedLongShifts.length > 0 ? sortedLongShifts.length + 1 : 0);
  const privateTrailingColSpan = 4;

  const amDayShadow = 'shadow-[inset_-1px_0_0_#e2e8f0,inset_0_3px_0_#334155,inset_0_-1px_0_#cbd5e1]';
  const amFirstStatShadow = 'shadow-[inset_2.5px_0_0_#334155,inset_0_3px_0_#334155,inset_0_-1px_0_#cbd5e1]';
  const amTrailShadow = 'shadow-[inset_0_3px_0_#334155,inset_0_-1px_0_#cbd5e1]';

  const pmDayShadow = 'shadow-[inset_-1px_0_0_#e2e8f0,inset_0_-2px_0_#64748b]';
  const pmFirstStatShadow = 'shadow-[inset_2.5px_0_0_#334155,inset_0_-2px_0_#64748b]';
  const pmTrailShadow = 'shadow-[inset_0_-2px_0_#64748b]';

  const totalDayShadow = isPrivate
    ? 'shadow-[inset_-1px_0_0_#cbd5e1,inset_0_3px_0_#334155,inset_0_-3px_0_#334155]'
    : 'shadow-[inset_-1px_0_0_#cbd5e1,inset_0_-3px_0_#334155]';
  const totalFirstStatShadow = isPrivate
    ? 'shadow-[inset_2.5px_0_0_#334155,inset_0_3px_0_#334155,inset_0_-3px_0_#334155]'
    : 'shadow-[inset_2.5px_0_0_#334155,inset_0_-3px_0_#334155]';
  const totalTrailShadow = isPrivate
    ? 'shadow-[inset_0_3px_0_#334155,inset_0_-3px_0_#334155]'
    : 'shadow-[inset_0_-3px_0_#334155]';

  return (
    <>
      {!isPrivate && (
        <>
          {/* 1. 오전 합계 행 */}
          <tr className="bg-white border-0">
            <td className="sticky left-0 z-50 bg-white border-0 shadow-[inset_2.5px_0_0_#334155,inset_-1px_0_0_#cbd5e1,inset_0_3px_0_#334155,inset_0_-1px_0_#cbd5e1]"></td>
            <td className="sticky left-[32px] z-50 bg-white border-0 shadow-[inset_-1px_0_0_#cbd5e1,inset_0_3px_0_#334155,inset_0_-1px_0_#cbd5e1]"></td>
            <td className="sticky left-[78px] z-50 bg-white border-0 text-center py-2 font-black text-orange-600 text-[15px] shadow-[inset_-2px_0_0_#cbd5e1,inset_0_3px_0_#334155,inset_0_-1px_0_#cbd5e1]">
              오전
            </td>
            {showLongShifts && (
              <td className="relative z-40 bg-emerald-50/40 border-0 shadow-[inset_-2px_0_0_#64748b,inset_0_3px_0_#334155,inset_0_-1px_0_#cbd5e1]"></td>
            )}

            {daysArray.map(day => {
              const val = dailyStats[day].am;
              const expected = getExpectedCount(day);
              const isIncomplete = expected > 0 && val !== expected;
              const isToday = todayDay === day;

              return (
                <td
                  key={day}
                  onClick={() => onCellClick?.(day, 'AM')}
                  title={`${day}일 오전 순번 누락·중복 확인 (클릭)`}
                  className={`relative z-40 text-center py-2 border-0 align-middle cursor-pointer hover:bg-orange-50/80 transition-colors ${
                    isToday ? 'bg-blue-50' : 'bg-white'
                  } ${amDayShadow}`}
                >
                  {isIncomplete ? (
                    <span className="inline-flex items-center justify-center min-w-[26px] h-[23px] px-1 bg-red-50 text-red-600 ring-[2px] ring-red-500 rounded font-black text-[14.5px] shadow-sm">
                      {val}
                    </span>
                  ) : (
                    <span
                      className={`font-black text-[15px] ${
                        val > 0 ? 'text-orange-600' : 'text-slate-300'
                      }`}
                    >
                      {val}
                    </span>
                  )}
                </td>
              );
            })}
            <td className={`relative z-40 border-0 bg-white ${amFirstStatShadow}`}></td>
            <td
              colSpan={trailingColSpan - 1}
              className={`relative z-40 border-0 bg-white ${amTrailShadow}`}
            ></td>
          </tr>

          {/* 2. 오후 합계 행 */}
          <tr className="bg-white border-0">
            <td className="sticky left-0 z-50 bg-white border-0 shadow-[inset_2.5px_0_0_#334155,inset_-1px_0_0_#cbd5e1,inset_0_-2px_0_#64748b]"></td>
            <td className="sticky left-[32px] z-50 bg-white border-0 shadow-[inset_-1px_0_0_#cbd5e1,inset_0_-2px_0_#64748b]"></td>
            <td className="sticky left-[78px] z-50 bg-white border-0 text-center py-2 font-black text-blue-600 text-[15px] shadow-[inset_-2px_0_0_#cbd5e1,inset_0_-2px_0_#64748b]">
              오후
            </td>
            {showLongShifts && (
              <td className="relative z-40 bg-emerald-50/40 border-0 shadow-[inset_-2px_0_0_#64748b,inset_0_-2px_0_#64748b]"></td>
            )}

            {daysArray.map(day => {
              const val = dailyStats[day].pm;
              const expected = getExpectedCount(day);
              const isIncomplete = expected > 0 && val !== expected;
              const isToday = todayDay === day;

              return (
                <td
                  key={day}
                  onClick={() => onCellClick?.(day, 'PM')}
                  title={`${day}일 오후 순번 누락·중복 확인 (클릭)`}
                  className={`relative z-40 text-center py-2 border-0 align-middle cursor-pointer hover:bg-blue-50/80 transition-colors ${
                    isToday ? 'bg-blue-50' : 'bg-white'
                  } ${pmDayShadow}`}
                >
                  {isIncomplete ? (
                    <span className="inline-flex items-center justify-center min-w-[26px] h-[23px] px-1 bg-red-50 text-red-600 ring-[2px] ring-red-500 rounded font-black text-[14.5px] shadow-sm">
                      {val}
                    </span>
                  ) : (
                    <span
                      className={`font-black text-[15px] ${
                        val > 0 ? 'text-blue-600' : 'text-slate-300'
                      }`}
                    >
                      {val}
                    </span>
                  )}
                </td>
              );
            })}
            <td className={`relative z-40 border-0 bg-white ${pmFirstStatShadow}`}></td>
            <td
              colSpan={trailingColSpan - 1}
              className={`relative z-40 border-0 bg-white ${pmTrailShadow}`}
            ></td>
          </tr>
        </>
      )}

      {/* 3. 전체 합계 행 */}
      <tr className="bg-slate-100 border-0">
        <td
          className={`sticky left-0 z-50 bg-slate-200 border-0 ${
            isPrivate
              ? 'shadow-[inset_2.5px_0_0_#334155,inset_-1px_0_0_#cbd5e1,inset_0_3px_0_#334155,inset_0_-3px_0_#334155]'
              : 'shadow-[inset_2.5px_0_0_#334155,inset_-1px_0_0_#cbd5e1,inset_0_-3px_0_#334155]'
          }`}
        ></td>
        <td
          className={`sticky left-[32px] z-50 bg-slate-200 border-0 ${
            isPrivate
              ? 'shadow-[inset_-1px_0_0_#cbd5e1,inset_0_3px_0_#334155,inset_0_-3px_0_#334155]'
              : 'shadow-[inset_-1px_0_0_#cbd5e1,inset_0_-3px_0_#334155]'
          }`}
        ></td>
        <td
          className={`sticky left-[78px] z-50 bg-slate-100 border-0 text-center py-2 font-black text-slate-800 text-[15px] ${
            isPrivate
              ? 'shadow-[inset_-2px_0_0_#cbd5e1,inset_0_3px_0_#334155,inset_0_-3px_0_#334155]'
              : 'shadow-[inset_-2px_0_0_#cbd5e1,inset_0_-3px_0_#334155]'
          }`}
        >
          합계
        </td>
        {!isPrivate && showLongShifts && (
          <td className="relative z-40 bg-slate-200/70 border-0 shadow-[inset_-2px_0_0_#64748b,inset_0_-3px_0_#334155]"></td>
        )}

        {daysArray.map(day => {
          const val = dailyStats[day].total;
          const expectedTotal = getExpectedCount(day) * (isPrivate ? 1 : 2);
          const isIncomplete = expectedTotal > 0 && val !== expectedTotal;
          const isToday = todayDay === day;

          return (
            <td
              key={day}
              onClick={() => onCellClick?.(day, 'TOTAL')}
              title={`${day}일 전체 순번 누락·중복 확인 (클릭)`}
              className={`relative z-40 text-center py-2 border-0 align-middle cursor-pointer hover:bg-slate-200/80 transition-colors ${
                isToday ? 'bg-blue-100' : 'bg-slate-100'
              } ${totalDayShadow}`}
            >
              {isIncomplete ? (
                <span className="inline-flex items-center justify-center min-w-[26px] h-[23px] px-1 bg-red-50 text-red-600 ring-[2px] ring-red-500 rounded font-black text-[14.5px] shadow-sm">
                  {val}
                </span>
              ) : (
                <span
                  className={`font-black text-[15px] ${
                    val > 0 ? 'text-slate-800' : 'text-slate-300'
                  }`}
                >
                  {val}
                </span>
              )}
            </td>
          );
        })}
        <td className={`relative z-40 border-0 bg-slate-100 ${totalFirstStatShadow}`}></td>
        <td
          colSpan={isPrivate ? privateTrailingColSpan - 1 : trailingColSpan - 1}
          className={`relative z-40 border-0 bg-slate-100 ${totalTrailShadow}`}
        ></td>
      </tr>
    </>
  );
}