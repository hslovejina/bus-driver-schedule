// 파일 위치: components/modals/ResetConfirmModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CalendarDays, BusFront, ChevronLeft } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onResetSchedules: () => void;
  onClearAll: () => void;
}

export default function ResetConfirmModal({ isOpen, onClose, onResetSchedules, onClearAll }: Props) {
  const [step, setStep] = useState<'SELECT' | 'CONFIRM_SCHEDULE' | 'CONFIRM_ALL'>('SELECT');

  useEffect(() => {
    if (isOpen) setStep('SELECT');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[420px] max-h-[92dvh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {/* 1단계: 초기화 옵션 선택 */}
        {step === 'SELECT' && (
          <div className="p-7">
            <h2 className="text-[22px] font-black text-slate-800 mb-6 tracking-tight text-center">초기화 옵션 선택</h2>
            
            <div className="flex flex-col gap-3">
              {/* ✨ 수정 2: 늘어난 공간만큼 근무 데이터 초기화 버튼 크기 확대 및 행간 넓힘 */}
              <button 
                onClick={() => setStep('CONFIRM_SCHEDULE')}
                className="flex items-center gap-4 py-8 px-5 rounded-2xl bg-orange-50 border border-orange-200 hover:border-orange-400 hover:bg-orange-100 transition-all active:scale-95 text-left group shadow-sm"
              >
                <div className="bg-white p-4 rounded-xl shadow-sm text-orange-500 group-hover:scale-110 transition-transform shrink-0">
                  <CalendarDays size={28} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-[17px] text-orange-700 mb-2">근무 데이터 초기화</h3>
                  <p className="text-[13px] font-bold text-orange-600/80 leading-[1.6]">
                    차량 및 기사 명단은 그대로 유지하고 날짜 칸에 입력된 <strong className="text-orange-700">일정 데이터만 모두 지웁니다.</strong>
                  </p>
                </div>
              </button>

              {/* ✨ 수정 1: 글자 크기는 유지하되 상하 여백(Padding)을 최소화하여 압축 */}
              <button 
                onClick={() => setStep('CONFIRM_ALL')}
                className="flex items-center gap-3 py-3 px-4 rounded-[16px] bg-red-50 border border-red-200 hover:border-red-400 hover:bg-red-100 transition-all active:scale-95 text-left group shadow-sm"
              >
                <div className="bg-white p-2 rounded-lg shadow-sm text-red-500 group-hover:scale-110 transition-transform shrink-0">
                  <BusFront size={22} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-[17px] text-red-700 mb-0.5">모든 데이터 초기화</h3>
                  <p className="text-[13px] font-bold text-red-600/80 leading-tight">
                    해당 월에 배차된 <strong className="text-red-700">차량, 명단, 일정을 싹 지우고</strong> 빈 달력으로 만듭니다.
                  </p>
                </div>
              </button>
            </div>

            <button onClick={onClose} className="w-full mt-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold rounded-xl transition-colors active:scale-95 text-[15px]">
              닫기
            </button>
          </div>
        )}

        {/* 2단계: 근무 데이터 초기화 경고 */}
        {step === 'CONFIRM_SCHEDULE' && (
          <div className="p-8 flex flex-col items-center text-center animate-in slide-in-from-right-4 duration-300">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-5 shadow-inner">
              <AlertTriangle size={32} className="text-orange-500" strokeWidth={2.5} />
            </div>
            <h2 className="text-[22px] font-black text-slate-900 mb-3 tracking-tight">근무 데이터를 지우시겠습니까?</h2>
            <p className="text-[15px] font-bold text-slate-500 leading-snug mb-8">
              입력된 모든 기사들의 근무 일정이 빈칸으로 돌아가며, <strong className="text-orange-600">명단은 유지</strong>됩니다.
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setStep('SELECT')} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl transition-colors active:scale-95 text-[15px] flex items-center justify-center gap-1">
                <ChevronLeft size={18} strokeWidth={3}/> 뒤로
              </button>
              <button onClick={() => { onResetSchedules(); onClose(); }} className="flex-[2] py-4 bg-orange-500 hover:bg-orange-600 text-white font-extrabold rounded-xl transition-colors active:scale-95 shadow-md shadow-orange-500/20 text-[15px]">
                근무 초기화 실행
              </button>
            </div>
          </div>
        )}

        {/* 2단계: 모든 데이터 초기화 경고 */}
        {step === 'CONFIRM_ALL' && (
          <div className="p-8 flex flex-col items-center text-center animate-in slide-in-from-right-4 duration-300">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-5 shadow-inner">
              <AlertTriangle size={32} className="text-red-600" strokeWidth={2.5} />
            </div>
            <h2 className="text-[22px] font-black text-slate-900 mb-3 tracking-tight">모든 데이터를 삭제하시겠습니까?</h2>
            <p className="text-[15px] font-bold text-slate-500 leading-snug mb-8">
              차번, 성명, 근무를 포함한 <strong className="text-red-600">이번 달의 모든 배차 정보가 완전히 삭제</strong>됩니다.
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setStep('SELECT')} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl transition-colors active:scale-95 text-[15px] flex items-center justify-center gap-1">
                <ChevronLeft size={18} strokeWidth={3}/> 뒤로
              </button>
              <button onClick={() => { onClearAll(); onClose(); }} className="flex-[2] py-4 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl transition-colors active:scale-95 shadow-md shadow-red-600/20 text-[15px]">
                전체 삭제 실행
              </button>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}