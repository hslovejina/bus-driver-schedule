// 파일 위치: components/modals/SubstituteListModal.tsx
'use client';

import React, { useState } from 'react';
import { X, Users, CheckCircle2, AlertCircle, ArrowRightLeft } from 'lucide-react';

export interface SubstituteCandidate {
  bIdx: number;
  dIdx: number;
  name: string;
  busNo: string;
  prevWork: string;
  nextWork: string;
  consecutiveDays: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  day: number;
  targetWork: string;
  targetDriverName: string;
  candidates: SubstituteCandidate[];
  onAssign?: (candidate: SubstituteCandidate, leaveType: '연차' | '신청휴무' | '') => void;
}

export default function SubstituteListModal({
  isOpen,
  onClose,
  day,
  targetWork,
  targetDriverName,
  candidates,
  onAssign,
}: Props) {
  const [leaveType, setLeaveType] = useState<'연차' | '신청휴무' | ''>('연차');

  if (!isOpen) return null;

  const isAm = targetWork.includes('전');

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[320] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        style={
          {
            zoom: 'var(--app-scale, 1)',
            maxHeight: 'calc(88dvh / var(--app-scale, 1))',
            maxWidth: 'min(32rem, calc((100vw - 1.5rem) / var(--app-scale, 1)))',
          } as React.CSSProperties
        }
        className="bg-white rounded-[28px] shadow-2xl w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <Users size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[19px] font-black text-slate-800 tracking-tight leading-none">
                {day}일 대체 가능 기사 목록
              </h2>
              <p className="text-[13px] font-bold text-slate-500 mt-1.5">
                기존 배정: <strong className="text-slate-800">{targetDriverName}</strong> 기사님
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-xl font-black text-[15px] text-white shadow-sm ${
                isAm ? 'bg-orange-500' : 'bg-blue-500'
              }`}
            >
              {targetWork}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X size={24} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-indigo-50/70 border-b border-indigo-100 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-extrabold text-indigo-900">
              기존 기사({targetDriverName}) 칸 자동 변경:
            </span>
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-indigo-200 shadow-sm">
              {(['연차', '신청휴무', ''] as const).map(opt => {
                const label = opt === '' ? '빈칸' : opt;
                const active = leaveType === opt;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setLeaveType(opt)}
                    className={`px-3 py-1 rounded-lg text-[12.5px] font-black transition-all ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between text-[11.5px] font-bold text-indigo-700/80">
            <span>• {isAm ? '전일 오후(후) 근무자 제외' : '익일 오전(전) 근무자 제외'}</span>
            <span>• 7일 연속 근무 성립자 제외 (기사 클릭 시 즉시 대체)</span>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 bg-white">
          {candidates.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <AlertCircle size={30} strokeWidth={2.2} />
              </div>
              <p className="text-[16px] font-black text-slate-600">
                조건에 부합하는 대체 가능 기사가 없습니다.
              </p>
              <p className="text-[13px] font-bold text-slate-400">
                (전/후일 교대 간격 및 최대 6일 연속근무 조건 기준)
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {candidates.map((cand, idx) => {
                const isSp = cand.busNo.toUpperCase() === 'SP';
                return (
                  <button
                    type="button"
                    key={`${cand.busNo}-${cand.name}-${idx}`}
                    onClick={() => onAssign?.(cand, leaveType)}
                    className="group flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-indigo-600 hover:border-indigo-600 transition-all shadow-sm active:scale-95 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`px-2 py-1 rounded-lg text-[12px] font-black shrink-0 border transition-colors ${
                          isSp
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200 group-hover:bg-white/20 group-hover:text-white group-hover:border-white/30'
                            : 'bg-white text-slate-700 border-slate-200 group-hover:bg-white/20 group-hover:text-white group-hover:border-white/30'
                        }`}
                      >
                        {cand.busNo}
                      </span>
                      <span className="font-black text-[15.5px] text-slate-900 group-hover:text-white truncate">
                        {cand.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 group-hover:bg-white group-hover:text-indigo-700 transition-colors">
                        연속 {cand.consecutiveDays}일
                      </span>
                      <ArrowRightLeft
                        size={14}
                        className="text-slate-300 group-hover:text-white transition-colors ml-0.5"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[13.5px] font-extrabold text-slate-600 flex items-center gap-1.5 pl-2">
            <CheckCircle2 size={17} className="text-emerald-600" strokeWidth={2.5} />총{' '}
            <strong className="text-indigo-600">{candidates.length}명</strong> 대체 가능 (클릭 시 즉시 배정)
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-xl text-[15px] transition-all active:scale-95 shadow-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}