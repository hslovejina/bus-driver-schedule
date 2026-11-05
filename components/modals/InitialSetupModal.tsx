// 파일 위치: components/modals/InitialSetupModal.tsx
'use client';

import React from 'react';
import { AlertTriangle, Wand2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  hasExistingData: boolean;
  isEmptyRoster?: boolean;
  isPrivate?: boolean;
  onClose: () => void;
  onConfirmSetup: () => void;
}

export default function InitialSetupModal({
  isOpen,
  hasExistingData,
  isEmptyRoster = false,
  isPrivate = false,
  onClose,
  onConfirmSetup,
}: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[340] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        style={
          {
            zoom: 'var(--app-scale, 1)',
            maxHeight: 'calc(90dvh / var(--app-scale, 1))',
            maxWidth: 'min(410px, calc((100vw - 1.5rem) / var(--app-scale, 1)))',
          } as React.CSSProperties
        }
        className="bg-white text-slate-800 shadow-[0_10px_40px_rgba(0,0,0,0.25)] rounded-[28px] border border-slate-200 w-full overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-7 flex flex-col items-center text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 shadow-inner ${
              hasExistingData ? 'bg-red-100' : 'bg-indigo-100'
            }`}
          >
            {hasExistingData ? (
              <AlertTriangle size={32} className="text-red-600" strokeWidth={2.5} />
            ) : (
              <Wand2 size={30} className="text-indigo-600" strokeWidth={2.5} />
            )}
          </div>

          <h2 className="text-[21px] font-black text-slate-900 mb-3 tracking-tight">
            {isEmptyRoster
              ? '명단 호출 + 초기세팅을 한 번에 실행할까요?'
              : hasExistingData
              ? '기존 근무를 삭제하고 초기세팅할까요?'
              : '초기 기본 근무를 자동 입력할까요?'}
          </h2>

          <p className="text-[14.5px] font-bold text-slate-500 leading-relaxed mb-7 break-keep">
            {isEmptyRoster ? (
              isPrivate ? (
                <>
                  현재 빈 달력입니다. 이전 달의 <strong className="text-indigo-600">차량·A/B조 기사 명단</strong>을 자동으로 불러옴과 동시에 이전 달 순번에 이어 이번 달 기본 배차까지 한 번에 완성합니다.
                </>
              ) : (
                <>
                  현재 빈 달력입니다. 이전 달의 <strong className="text-indigo-600">차량·성명·기본휴무</strong>를 자동으로 불러옴과 동시에 이번 달 기본 배차까지 한 번에 완성합니다.
                </>
              )
            ) : hasExistingData ? (
              <>
                현재 달력에 이미 입력된 근무(또는 신청휴무·연차)가 있습니다.
                <br />
                <strong className="text-red-600">기존 일정을 모두 삭제</strong>하고 이전 달 패턴에 맞춰 초기 기본 근무를 자동 입력합니다.
              </>
            ) : isPrivate ? (
              <>
                이전 달의 <strong className="text-indigo-600">A/B조 근무 순번 패턴</strong>을 분석하여 이번 달 기본 배차를 연속성 있게 자동으로 입력합니다.
              </>
            ) : (
              <>
                이전 달의 근무 패턴과 각 기사의 <strong className="text-indigo-600">기본휴무</strong>를 분석하여 이번 달 기본 배차를 자동으로 입력합니다.
              </>
            )}
          </p>

          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl transition-colors active:scale-95 text-[15px]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirmSetup();
                onClose();
              }}
              className={`flex-1 py-3.5 text-white font-extrabold rounded-xl transition-colors active:scale-95 shadow-md text-[15px] ${
                hasExistingData
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
              }`}
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}