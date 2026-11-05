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

  const amTopBotBorder = 'border-t-[2.5px] border-t-slate-700 border-b border-b-slate-300';
  const pmTopBotBorder = 'border-b-[2px] border-b-slate-500';
  const totalTopBotBorder = isPrivate
    ? 'border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-700'
    : 'border-b-[2.5px] border-b-slate-700';

  const renderTrailingStatCells = (bgClass: string, rowBorderClass: string) => {
    if (isPrivate) {
      return (
        <>
          <td className={`relative z-40 border-r border-r-slate-200 ${bgClass} ${rowBorderClass}`} />
          <td className={`relative z-40 border-r border-r-rose-100 ${bgClass} ${rowBorderClass}`} />
          <td className={`relative z-40 border-r-[2.5px] border-r-slate-700 ${bgClass} ${rowBorderClass}`} />
          <td className={`relative z-40 border-r-[2.5px] border-r-slate-700 ${bgClass} ${rowBorderClass}`} />
        </>
      );
    }

    return (
      <>
        <td className={`relative z-40 border-r border-r-slate-200 ${bgClass} ${rowBorderClass}`} />
        <td className={`relative z-40 border-r border-r-orange-100 ${bgClass} ${rowBorderClass}`} />
        <td className={`relative z-40 border-r-[2.5px] border-r-slate-700 ${bgClass} ${rowBorderClass}`} />
        <td className={`relative z-40 border-r border-r-emerald-200 ${bgClass} ${rowBorderClass}`} />
        <td className={`relative z-40 border-r-[2.5px] border-r-slate-700 ${bgClass} ${rowBorderClass}`} />
        <td className={`relative z-40 border-r border-r-rose-100 ${bgClass} ${rowBorderClass}`} />
        <td className={`relative z-40 border-r border-r-orange-100 ${bgClass} ${rowBorderClass}`} />
        <td className={`relative z-40 border-r-[2.5px] border-r-slate-700 ${bgClass} ${rowBorderClass}`} />
        <td className={`relative z-40 border-r-[2.5px] border-r-slate-700 ${bgClass} ${rowBorderClass}`} />
        {showLongShifts && sortedLongShifts.length > 0 && (
          <>
            {sortedLongShifts.map(shift => (
              <td
                key={shift}
                className={`relative z-40 border-r border-r-amber-100 ${bgClass} ${rowBorderClass}`}
              />
            ))}
            <td className={`relative z-40 border-r-[2.5px] border-r-slate-700 ${bgClass} ${rowBorderClass}`} />
          </>
        )}
      </>
    );
  };

  return (
    <>
      {!isPrivate && (
        <>
          {/* 1. 오전 합계 행 (상하 여백 최소화 h-[22px]) */}
          <tr className="bg-white h-[22px]">
            <td className={`sticky left-0 z-50 bg-white border-l-[2.5px] border-l-slate-700 border-r border-r-slate-300 ${amTopBotBorder}`}></td>
            <td className={`sticky left-[22px] z-50 bg-white border-r border-r-slate-300 ${amTopBotBorder}`}></td>
            <td className={`sticky left-[58px] z-50 bg-white border-r-[2px] border-r-slate-400 text-center py-0.5 px-0 font-black text-orange-600 text-[12.5px] leading-none ${amTopBotBorder}`}>
              오전
            </td>
            {showLongShifts && (
              <td className={`relative z-40 bg-emerald-50 border-r-[2px] border-r-slate-500 ${amTopBotBorder}`}></td>
            )}

            {daysArray.map((day, idx) => {
              const val = dailyStats[day].am;
              const expected = getExpectedCount(day);
              const isIncomplete = expected > 0 && val !== expected;
              const isToday = todayDay === day;
              const isLastDay = idx === daysArray.length - 1;
              const rightBorder = isLastDay ? 'border-r-[2.5px] border-r-slate-700' : 'border-r border-r-slate-200';

              return (
                <td
                  key={day}
                  onClick={() => onCellClick?.(day, 'AM')}
                  title={`${day}일 오전 순번 누락·중복 확인 (클릭)`}
                  className={`relative z-40 text-center py-0.5 px-0 ${rightBorder} align-middle cursor-pointer hover:bg-orange-50 transition-colors ${
                    isToday ? 'bg-blue-50' : 'bg-white'
                  } ${amTopBotBorder}`}
                >
                  {isIncomplete ? (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-[17px] px-0.5 bg-red-50 text-red-600 ring-[1.5px] ring-red-500 rounded font-black text-[12px] xl:text-[12.5px] leading-none">
                      {val}
                    </span>
                  ) : (
                    <span
                      className={`font-black text-[12.5px] xl:text-[13px] leading-none ${
                        val > 0 ? 'text-orange-600' : 'text-slate-300'
                      }`}
                    >
                      {val}
                    </span>
                  )}
                </td>
              );
            })}
            {renderTrailingStatCells('bg-white', amTopBotBorder)}
          </tr>

          {/* 2. 오후 합계 행 (상하 여백 최소화 h-[22px]) */}
          <tr className="bg-white h-[22px]">
            <td className={`sticky left-0 z-50 bg-white border-l-[2.5px] border-l-slate-700 border-r border-r-slate-300 ${pmTopBotBorder}`}></td>
            <td className={`sticky left-[22px] z-50 bg-white border-r border-r-slate-300 ${pmTopBotBorder}`}></td>
            <td className={`sticky left-[58px] z-50 bg-white border-r-[2px] border-r-slate-400 text-center py-0.5 px-0 font-black text-blue-600 text-[12.5px] leading-none ${pmTopBotBorder}`}>
              오후
            </td>
            {showLongShifts && (
              <td className={`relative z-40 bg-emerald-50 border-r-[2px] border-r-slate-500 ${pmTopBotBorder}`}></td>
            )}

            {daysArray.map((day, idx) => {
              const val = dailyStats[day].pm;
              const expected = getExpectedCount(day);
              const isIncomplete = expected > 0 && val !== expected;
              const isToday = todayDay === day;
              const isLastDay = idx === daysArray.length - 1;
              const rightBorder = isLastDay ? 'border-r-[2.5px] border-r-slate-700' : 'border-r border-r-slate-200';

              return (
                <td
                  key={day}
                  onClick={() => onCellClick?.(day, 'PM')}
                  title={`${day}일 오후 순번 누락·중복 확인 (클릭)`}
                  className={`relative z-40 text-center py-0.5 px-0 ${rightBorder} align-middle cursor-pointer hover:bg-blue-50 transition-colors ${
                    isToday ? 'bg-blue-50' : 'bg-white'
                  } ${pmTopBotBorder}`}
                >
                  {isIncomplete ? (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-[17px] px-0.5 bg-red-50 text-red-600 ring-[1.5px] ring-red-500 rounded font-black text-[12px] xl:text-[12.5px] leading-none">
                      {val}
                    </span>
                  ) : (
                    <span
                      className={`font-black text-[12.5px] xl:text-[13px] leading-none ${
                        val > 0 ? 'text-blue-600' : 'text-slate-300'
                      }`}
                    >
                      {val}
                    </span>
                  )}
                </td>
              );
            })}
            {renderTrailingStatCells('bg-white', pmTopBotBorder)}
          </tr>
        </>
      )}

      {/* 3. 전체 합계 행 (상하 여백 최소화 h-[22px]) */}
      <tr className="bg-slate-100 h-[22px]">
        <td className={`sticky left-0 z-50 bg-slate-200 border-l-[2.5px] border-l-slate-700 border-r border-r-slate-300 ${totalTopBotBorder}`}></td>
        <td className={`sticky left-[22px] z-50 bg-slate-200 border-r border-r-slate-300 ${totalTopBotBorder}`}></td>
        <td className={`sticky left-[58px] z-50 bg-slate-100 border-r-[2px] border-r-slate-400 text-center py-0.5 px-0 font-black text-slate-800 text-[12.5px] leading-none ${totalTopBotBorder}`}>
          합계
        </td>
        {!isPrivate && showLongShifts && (
          <td className={`relative z-40 bg-slate-200 border-r-[2px] border-r-slate-500 ${totalTopBotBorder}`}></td>
        )}

        {daysArray.map((day, idx) => {
          const val = dailyStats[day].total;
          const expectedTotal = getExpectedCount(day) * (isPrivate ? 1 : 2);
          const isIncomplete = expectedTotal > 0 && val !== expectedTotal;
          const isToday = todayDay === day;
          const isLastDay = idx === daysArray.length - 1;
          const rightBorder = isLastDay ? 'border-r-[2.5px] border-r-slate-700' : 'border-r border-r-slate-300';

          return (
            <td
              key={day}
              onClick={() => onCellClick?.(day, 'TOTAL')}
              title={`${day}일 전체 순번 누락·중복 확인 (클릭)`}
              className={`relative z-40 text-center py-0.5 px-0 ${rightBorder} align-middle cursor-pointer hover:bg-slate-200 transition-colors ${
                isToday ? 'bg-blue-100' : 'bg-slate-100'
              } ${totalTopBotBorder}`}
            >
              {isIncomplete ? (
                <span className="inline-flex items-center justify-center min-w-[20px] h-[17px] px-0.5 bg-red-50 text-red-600 ring-[1.5px] ring-red-500 rounded font-black text-[12px] xl:text-[12.5px] leading-none">
                  {val}
                </span>
              ) : (
                <span
                  className={`font-black text-[12.5px] xl:text-[13px] leading-none ${
                    val > 0 ? 'text-slate-800' : 'text-slate-300'
                  }`}
                >
                  {val}
                </span>
              )}
            </td>
          );
        })}
        {renderTrailingStatCells('bg-slate-100', totalTopBotBorder)}
      </tr>
    </>
  );
}