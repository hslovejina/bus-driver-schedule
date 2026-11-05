// 파일 위치: components/modals/MonthPickerModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  currentMonth: number;
  onSelect: (month: number, year: number) => void;
}

export default function MonthPickerModal({
  isOpen,
  onClose,
  currentYear,
  currentMonth,
  onSelect,
}: Props) {
  const [pickerYear, setPickerYear] = useState(currentYear);

  useEffect(() => {
    if (isOpen) setPickerYear(currentYear);
  }, [isOpen, currentYear]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        style={
          {
            zoom: 'var(--app-scale, 1)',
            maxHeight: 'calc(90dvh / var(--app-scale, 1))',
            maxWidth: 'min(24rem, calc((100vw - 1.5rem) / var(--app-scale, 1)))',
          } as React.CSSProperties
        }
        className="bg-white rounded-3xl shadow-2xl p-5 sm:p-6 w-full overflow-y-auto animate-in zoom-in-95 duration-200 border border-slate-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 bg-slate-50 rounded-2xl p-2 border border-slate-100">
          <button
            onClick={() => setPickerYear(y => y - 1)}
            className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl transition-all shadow-sm active:scale-95"
          >
            <ChevronLeft size={22} strokeWidth={3} />
          </button>
          <span className="font-black text-xl text-slate-800 tracking-tight">{pickerYear}년</span>
          <button
            onClick={() => setPickerYear(y => y + 1)}
            className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl transition-all shadow-sm active:scale-95"
          >
            <ChevronRight size={22} strokeWidth={3} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
            const isCurrent = pickerYear === currentYear && m === currentMonth;
            return (
              <button
                key={m}
                onClick={() => onSelect(m, pickerYear)}
                className={`py-3.5 rounded-xl font-bold text-[15px] transition-all active:scale-95 ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                {m}월
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full py-4 bg-slate-100 text-slate-600 font-extrabold text-[15px] rounded-xl hover:bg-slate-200 transition-colors active:scale-95"
        >
          닫기
        </button>
      </div>
    </div>
  );
}