// 파일 위치: components/modals/AddDriverModal.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (type: 'BUS' | 'SP', busNo: string) => { success: boolean; duplicate?: boolean };
  isPrivate?: boolean;
}

export default function AddDriverModal({ isOpen, onClose, onAdd, isPrivate }: Props) {
  const [type, setType] = useState<'BUS' | 'SP'>('BUS');
  const [busNo, setBusNo] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setType('BUS');
      setBusNo('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleTypeChange = (newType: 'BUS' | 'SP') => {
    setType(newType);
    if (newType === 'BUS') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'BUS' && !busNo.trim()) return;

    const result = onAdd(type, type === 'SP' ? 'SP' : busNo);

    if (result.success) {
      onClose();
    } else if (result.duplicate) {
      alert(`입력하신 '${busNo.trim()}' 차번은 이미 배차표에 등록되어 있습니다.\n다른 번호를 입력해 주세요.`);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        style={
          {
            zoom: 'var(--app-scale, 1)',
            maxHeight: 'calc(90dvh / var(--app-scale, 1))',
            maxWidth: 'min(24rem, calc((100vw - 1.5rem) / var(--app-scale, 1)))',
          } as React.CSSProperties
        }
        className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto animate-in zoom-in-95 duration-200"
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-center rounded-t-2xl">
          <h2 className="text-xl font-black text-gray-800 tracking-tight">차량 및 기사 추가</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {!isPrivate && (
            <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => handleTypeChange('BUS')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                  type === 'BUS'
                    ? 'bg-white text-blue-600 shadow-sm border border-blue-200 ring-1 ring-blue-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                고정 차번
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('SP')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                  type === 'SP'
                    ? 'bg-white text-blue-600 shadow-sm border border-blue-200 ring-1 ring-blue-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                SP (스페어)
              </button>
            </div>
          )}

          <div
            className={`transition-all duration-300 overflow-hidden ${
              type === 'BUS' ? 'opacity-100 max-h-[120px]' : 'opacity-0 max-h-0 pointer-events-none'
            }`}
          >
            <div className="p-1">
              <label className="block text-xs font-extrabold text-slate-600 mb-2 tracking-tight">
                차량 번호
              </label>
              <input
                ref={inputRef}
                type="text"
                value={busNo}
                onChange={e => setBusNo(e.target.value)}
                placeholder="예: 397"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl transition-colors active:scale-95 text-[15px]"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-[2] py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition-colors active:scale-95 shadow-md shadow-blue-600/20 text-[15px]"
            >
              확인 및 추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}