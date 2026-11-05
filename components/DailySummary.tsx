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

  // 상/하단 가로선만 inset shadow로 처리하고 좌/우 세로선은 실제 border-r / border-l을 사용하여 본문 열과 100% 일치시킴
  const amRowTopBotShadow = 'shadow-[inset_0_3px_0_#334155,inset_0_-1px_0_#cbd5e1]';
  const pmRowTopBotShadow = 'shadow-[inset_0_-2px_0_#64748b]';
  const totalRowTopBotShadow = isPrivate
    ? 'shadow-[inset_0_3px_0_#334155,inset_0_-3px_0_#334155]'
    : 'shadow-[inset_0_-3px_0_#334155]';

  // 우측 통계 영역의 세로 구분선들도 상단부터 하단까지 일직선으로 이어지도록 동일 구조로 렌더링
  const renderTrailingStatCells = (bgClass: string, rowShadow: string) => {
    if (isPrivate) {
      return (
        <>
          <td className={`relative z-40 border-l-[2.5px] border-l-slate-700 border-r border-slate-200 ${bgClass} ${rowShadow}`} />
          <td className={`relative z-40 border-r border-rose-100 ${bgClass} ${rowShadow}`} />
          <td className={`relative z-40 border-r-[2.5px] border-r-slate-700 ${bgClass} ${rowShadow}`} />
          <td className={`relative z-40 border-0 ${bgClass} ${rowShadow}`} />
        </>
      );
    }

    return (
      <>
        <td className={`relative z-40 border-l-[2.5px] border-l-slate-700 border-r border-slate-200 ${bgClass} ${rowShadow}`} />
        <td className={`relative z-40 border-r border-orange-100 ${bgClass} ${rowShadow}`} />
        <td className={`relative z-40 border-r-[2.5px] border-r-slate-700 ${bgClass} ${rowShadow}`} />
        <td className={`relative z-40 border-r border-emerald-200 ${bgClass} ${rowShadow}`} />
        <td className={`relative z-40 border-r-[2.5px] border-r-slate-700 ${bgClass} ${rowShadow}`} />
        <td className={`relative z-40 border-r border-rose-100 ${bgClass} ${rowShadow}`} />
        <td className={`relative z-40 border-r border-orange-100 ${bgClass} ${rowShadow}`} />
        <td className={`relative z-40 border-r-[2.5px] border-r-slate-700 ${bgClass} ${rowShadow}`} />
        <td className={`relative z-40 border-0 ${bgClass} ${rowShadow}`} />
        {showLongShifts && sortedLongShifts.length > 0 && (
          <>
            {sortedLongShifts.map((shift, idx) => (
              <td
                key={shift}
                className={`relative z-40 border-r border-amber-100 ${
                  idx === 0 ? 'border-l-[2.5px] border-l-slate-700' : ''
                } ${bgClass} ${rowShadow}`}
              />
            ))}
            <td className={`relative z-40 border-r-[2.5px] border-r-slate-700 ${bgClass} ${rowShadow}`} />
          </>
        )}
      </>
    );
  };

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
              <td className={`relative z-40 bg-emerald-50/40 border-r-[2px] border-r-slate-500 ${amRowTopBotShadow}`}></td>
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
                  className={`relative z-40 text-center py-2 border-r border-slate-200 align-middle cursor-pointer hover:bg-orange-50/80 transition-colors ${
                    isToday ? 'bg-blue-50' : 'bg-white'
                  } ${amRowTopBotShadow}`}
                >
                  {isIncomplete ? (
                    <span className="inline-flex items-center justify-center min-w-[24px] h-[22px] px-1 bg-red-50 text-red-600 ring-[2px] ring-red-500 rounded font-black text-[13.5px] xl:text-[14.5px] shadow-sm">
                      {val}
                    </span>
                  ) : (
                    <span
                      className={`font-black text-[14px] xl:text-[15px] ${
                        val > 0 ? 'text-orange-600' : 'text-slate-300'
                      }`}
                    >
                      {val}
                    </span>
                  )}
                </td>
              );
            })}
            {renderTrailingStatCells('bg-white', amRowTopBotShadow)}
          </tr>

          {/* 2. 오후 합계 행 */}
          <tr className="bg-white border-0">
            <td className="sticky left-0 z-50 bg-white border-0 shadow-[inset_2.5px_0_0_#334155,inset_-1px_0_0_#cbd5e1,inset_0_-2px_0_#64748b]"></td>
            <td className="sticky left-[32px] z-50 bg-white border-0 shadow-[inset_-1px_0_0_#cbd5e1,inset_0_-2px_0_#64748b]"></td>
            <td className="sticky left-[78px] z-50 bg-white border-0 text-center py-2 font-black text-blue-600 text-[15px] shadow-[inset_-2px_0_0_#cbd5e1,inset_0_-2px_0_#64748b]">
              오후
            </td>
            {showLongShifts && (
              <td className={`relative z-40 bg-emerald-50/40 border-r-[2px] border-r-slate-500 ${pmRowTopBotShadow}`}></td>
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
                  className={`relative z-40 text-center py-2 border-r border-slate-200 align-middle cursor-pointer hover:bg-blue-50/80 transition-colors ${
                    isToday ? 'bg-blue-50' : 'bg-white'
                  } ${pmRowTopBotShadow}`}
                >
                  {isIncomplete ? (
                    <span className="inline-flex items-center justify-center min-w-[24px] h-[22px] px-1 bg-red-50 text-red-600 ring-[2px] ring-red-500 rounded font-black text-[13.5px] xl:text-[14.5px] shadow-sm">
                      {val}
                    </span>
                  ) : (
                    <span
                      className={`font-black text-[14px] xl:text-[15px] ${
                        val > 0 ? 'text-blue-600' : 'text-slate-300'
                      }`}
                    >
                      {val}
                    </span>
                  )}
                </td>
              );
            })}
            {renderTrailingStatCells('bg-white', pmRowTopBotShadow)}
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
          <td className={`relative z-40 bg-slate-200/70 border-r-[2px] border-r-slate-500 ${totalRowTopBotShadow}`}></td>
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
              className={`relative z-40 text-center py-2 border-r border-slate-300 align-middle cursor-pointer hover:bg-slate-200/80 transition-colors ${
                isToday ? 'bg-blue-100' : 'bg-slate-100'
              } ${totalRowTopBotShadow}`}
            >
              {isIncomplete ? (
                <span className="inline-flex items-center justify-center min-w-[24px] h-[22px] px-1 bg-red-50 text-red-600 ring-[2px] ring-red-500 rounded font-black text-[13.5px] xl:text-[14.5px] shadow-sm">
                  {val}
                </span>
              ) : (
                <span
                  className={`font-black text-[14px] xl:text-[15px] ${
                    val > 0 ? 'text-slate-800' : 'text-slate-300'
                  }`}
                >
                  {val}
                </span>
              )}
            </td>
          );
        })}
        {renderTrailingStatCells('bg-slate-100', totalRowTopBotShadow)}
      </tr>
    </>
  );
}