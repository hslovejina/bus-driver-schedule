// 파일 위치: components/modals/DriverShareModal.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Share2, CalendarDays, Coins, ListFilter } from 'lucide-react';
import type { DriverInfo, RowStatsResult } from '../../utils/calculator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  driver: DriverInfo | null;
  busNo: string;
  teamLabel?: string;
  route: string;
  year: number;
  month: number;
  daysArray: number[];
  holidays: Record<string, string>;
  rowStats?: RowStatsResult;
  isPrivate: boolean;
  onCopied?: (msg: string) => void;
}

const DOW_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function DriverShareModal({
  isOpen,
  onClose,
  driver,
  busNo,
  teamLabel,
  route,
  year,
  month,
  daysArray,
  holidays,
  rowStats,
  isPrivate,
  onCopied,
}: Props) {
  const [formatType, setFormatType] = useState<'WEEKLY' | 'DAILY'>('WEEKLY');
  const [includeSalary, setIncludeSalary] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const shareText = useMemo(() => {
    if (!driver) return '';

    const routePrefix = route && route !== '미지정' ? `${route}노선 ` : '';
    const busDisplay = isPrivate && teamLabel ? `${busNo} (${teamLabel})` : busNo;

    const lines: string[] = [];
    lines.push(`🚌 [${routePrefix}${year}년 ${month}월 근무표]`);
    lines.push(`👤 ${driver.name} 기사님 (차번: ${busDisplay})`);
    lines.push('━━━━━━━━━━━━━━━━━━');

    if (rowStats) {
      if (isPrivate) {
        lines.push(
          `📊 총근로: ${rowStats.totalWorkDays}일 | 절근로: ${rowStats.jeolnalTotal}일 | 복격: ${rowStats.bokgyeokCount}회`
        );
      } else {
        lines.push(
          `📊 총근로: ${rowStats.totalWorkDays}일 (오전 ${rowStats.amCount} / 오후 ${rowStats.pmCount})`
        );
        lines.push(
          `📌 소정: ${rowStats.targetSojeong}일 | 고정휴무: ${rowStats.fixedRestsStr} | 추가: ${rowStats.extraTotal}일`
        );
      }
      if (includeSalary && rowStats.expectedSalary > 0) {
        lines.push(`💰 예상급여: ${rowStats.expectedSalary.toLocaleString()}원`);
      }
      lines.push('━━━━━━━━━━━━━━━━━━');
    }

    const formatWorkLabel = (raw: string | undefined) => {
      const w = (raw || '').trim();
      if (!w || w === '-' || w === '휴무') return '휴무';
      if (w === '신청휴무' || w === 'x' || w === 'X') return '신청휴무(X)';
      if (isPrivate && /^\d+$/.test(w)) return `${w}번`;
      return w;
    };

    if (formatType === 'WEEKLY') {
      let currentWeek = 1;
      let weekItems: string[] = [];

      daysArray.forEach((day, idx) => {
        const dowIdx = new Date(year, month - 1, day).getDay();
        const dow = DOW_NAMES[dowIdx];
        const work = (driver.schedules[String(day)] || '').trim();
        const shortWork =
          !work || work === '-' || work === '휴무'
            ? '휴'
            : work === '신청휴무' || work === 'x' || work === 'X'
            ? 'X'
            : isPrivate && /^\d+$/.test(work)
            ? `${work}번`
            : work;

        weekItems.push(`${day}(${dow}):${shortWork}`);

        if (dowIdx === 6 || idx === daysArray.length - 1) {
          lines.push(`[${currentWeek}주] ${weekItems.join(' / ')}`);
          weekItems = [];
          currentWeek++;
        }
      });
    } else {
      daysArray.forEach(day => {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dow = DOW_NAMES[new Date(year, month - 1, day).getDay()];
        const holidayName = holidays[dateStr];
        const workLabel = formatWorkLabel(driver.schedules[String(day)]);
        const dayStr = String(day).padStart(2, '0');
        const holSuffix = holidayName ? ` [${holidayName}]` : '';
        lines.push(`${month}/${dayStr}(${dow}) : ${workLabel}${holSuffix}`);
      });
    }

    return lines.join('\n');
  }, [driver, busNo, teamLabel, route, year, month, daysArray, holidays, rowStats, isPrivate, formatType, includeSalary]);

  if (!isOpen || !driver) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      onCopied?.(`${driver.name} 기사님의 ${month}월 근무표가 클립보드에 복사되었습니다.`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('복사에 실패했습니다. 텍스트를 직접 선택하여 복사해 주세요.');
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${year}년 ${month}월 ${driver.name} 기사님 근무표`,
          text: shareText,
        });
      } catch {
        // 사용자 공유 취소 시 무시
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[350] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200 border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
              <CalendarDays size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[19px] font-black text-slate-800 tracking-tight leading-none">
                {driver.name} 기사님 근무표 공유
              </h2>
              <p className="text-[13px] font-bold text-slate-500 mt-1.5">
                {year}년 {month}월 · 차번 <strong className="text-slate-700">{busNo}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        {/* 공유 옵션 바 */}
        <div className="px-6 py-3.5 bg-indigo-50/60 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-indigo-200 shadow-sm">
            <ListFilter size={15} className="text-indigo-500 ml-1.5" />
            <button
              type="button"
              onClick={() => setFormatType('WEEKLY')}
              className={`px-3 py-1 rounded-lg text-[12.5px] font-black transition-all ${
                formatType === 'WEEKLY'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              주차별 요약형
            </button>
            <button
              type="button"
              onClick={() => setFormatType('DAILY')}
              className={`px-3 py-1 rounded-lg text-[12.5px] font-black transition-all ${
                formatType === 'DAILY'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              일자별 목록형
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-sm">
            <input
              type="checkbox"
              checked={includeSalary}
              onChange={e => setIncludeSalary(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
            />
            <Coins size={15} className="text-amber-500" />
            <span className="text-[12.5px] font-extrabold text-slate-700">예상급여 포함</span>
          </label>
        </div>

        {/* 미리보기 텍스트 박스 */}
        <div className="p-5 flex-1 overflow-y-auto bg-slate-100/70">
          <pre className="w-full p-4 bg-white rounded-2xl border border-slate-200 text-[13.5px] font-bold text-slate-800 whitespace-pre-wrap leading-relaxed font-sans shadow-inner select-all">
            {shareText}
          </pre>
        </div>

        {/* 하단 액션 버튼 */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-[15px] transition-all active:scale-95"
          >
            닫기
          </button>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="px-4 py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold rounded-xl text-[15px] transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Share2 size={18} strokeWidth={2.5} /> 앱으로 공유
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className={`flex-1 py-3.5 font-black rounded-xl text-[15.5px] transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 ${
              copied
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
            }`}
          >
            {copied ? (
              <>
                <Check size={19} strokeWidth={3} /> 클립보드에 복사 완료!
              </>
            ) : (
              <>
                <Copy size={18} strokeWidth={2.5} /> 카카오톡·문자용 근무표 복사
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}