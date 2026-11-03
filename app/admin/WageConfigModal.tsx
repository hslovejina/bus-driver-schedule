// 파일 위치: app/admin/WageConfigModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Coins,
  Calendar,
  ClipboardPaste,
  Percent,
  RotateCcw,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import {
  DEFAULT_PRIVATE_PAY_TABLE,
  type PrivatePayRow,
  type PrivatePayTableMap,
  type SystemPayConfig,
} from '@/utils/calculator';

interface Props {
  isOpen: boolean;
  globalWage: number;
  payConfig: SystemPayConfig | null;
  onClose: () => void;
  onSaved: () => void;
}

const DAY_STEPS = Array.from({ length: 32 }, (_, i) => (i + 1) * 0.5);

function getDefaultTableMap(): PrivatePayTableMap {
  const map: PrivatePayTableMap = {};
  DAY_STEPS.forEach(d => {
    const row = DEFAULT_PRIVATE_PAY_TABLE[d] || { basic: 0, ot: 0, night: 0, juhyu: 0, extra: 0 };
    map[String(d)] = { ...row };
  });
  return map;
}

export default function WageConfigModal({
  isOpen,
  globalWage,
  payConfig,
  onClose,
  onSaved,
}: Props) {
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [activeTab, setActiveTab] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [isSaving, setIsSaving] = useState(false);

  // 1. 공공관리제 상태
  const [pubWage, setPubWage] = useState<number>(globalWage);
  const [pubStartYm, setPubStartYm] = useState<string>(currentYm);
  const [pubApplyAllPast, setPubApplyAllPast] = useState<boolean>(false);

  // 2. 민영제 상태
  const [privStartYm, setPrivStartYm] = useState<string>(currentYm);
  const [privApplyAllPast, setPrivApplyAllPast] = useState<boolean>(false);
  const [jeolWage, setJeolWage] = useState<number>(17201);
  const [safeBonus, setSafeBonus] = useState<number>(60000);
  const [payTable, setPayTable] = useState<PrivatePayTableMap>(() => getDefaultTableMap());

  // 도우미 도구 상태 (엑셀 붙여넣기 & 인상률 계산)
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');
  const [increaseRate, setIncreaseRate] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    setPubWage(globalWage);
    setPubStartYm(currentYm);
    setPubApplyAllPast(false);
    setPrivStartYm(currentYm);
    setPrivApplyAllPast(false);

    // 가장 최신 민영 규칙이 있으면 기본 로드
    const privRules = payConfig?.privateRules || [];
    if (privRules.length > 0) {
      const sorted = [...privRules].sort((a, b) =>
        b.startYearMonth.localeCompare(a.startYearMonth)
      );
      const latest = sorted[0];
      setJeolWage(latest.jeolHourlyWage || 17201);
      setSafeBonus(latest.safeBonus ?? 60000);
      setPayTable(latest.payTable ? JSON.parse(JSON.stringify(latest.payTable)) : getDefaultTableMap());
    } else {
      setJeolWage(17201);
      setSafeBonus(60000);
      setPayTable(getDefaultTableMap());
    }
  }, [isOpen, globalWage, payConfig, currentYm]);

  if (!isOpen) return null;

  const handlePublicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetDesc = pubApplyAllPast
      ? '과거 모든 기록을 포함하여 일괄'
      : `${pubStartYm}월 배차표부터`;
    if (
      !confirm(
        `공공관리제 시급을 ${pubWage.toLocaleString()}원으로 [${targetDesc}] 적용하시겠습니까?`
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_WAGE',
          wage: pubWage,
          startYearMonth: pubStartYm,
          applyAllPast: pubApplyAllPast,
        }),
      });
      if (res.ok) {
        alert('공공관리제 시급이 성공적으로 저장되었습니다.');
        onSaved();
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetDesc = privApplyAllPast
      ? '과거 모든 기록을 포함하여 일괄'
      : `${privStartYm}월 배차표부터`;
    if (!confirm(`민영제 조견표 및 절근로 시급을 [${targetDesc}] 적용하시겠습니까?`)) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_PRIVATE_PAY_CONFIG',
          startYearMonth: privApplyAllPast ? '2000-01' : privStartYm,
          jeolHourlyWage: jeolWage,
          safeBonus,
          payTable,
          applyAllPast: privApplyAllPast,
        }),
      });
      if (res.ok) {
        alert('민영제 조견표 및 시급 설정이 성공적으로 저장되었습니다.');
        onSaved();
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (type: 'PUBLIC' | 'PRIVATE', startYearMonth: string) => {
    if (!confirm(`[${startYearMonth}~] 적용 이력을 삭제하시겠습니까?`)) return;
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_PAY_RULE', ruleType: type, startYearMonth }),
    });
    if (res.ok) {
      onSaved();
    }
  };

  const handleCellChange = (dayKey: string, field: keyof PrivatePayRow, valStr: string) => {
    const num = Number(valStr.replace(/[^0-9]/g, '')) || 0;
    setPayTable(prev => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || { basic: 0, ot: 0, night: 0, juhyu: 0, extra: 0 }),
        [field]: num,
      },
    }));
  };

  // 엑셀 복사본(탭/공백 구분 텍스트) 일괄 파싱 적용
  const handleApplyPaste = () => {
    const lines = pasteText
      .trim()
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      alert('붙여넣은 내용이 없습니다.');
      return;
    }

    const updated = { ...payTable };
    let appliedRows = 0;

    lines.forEach((line, idx) => {
      const cols = line
        .split(/\t|\s{2,}/)
        .map(c => Number(c.replace(/[^0-9.]/g, '')))
        .filter(n => !isNaN(n));

      if (cols.length >= 6 && cols[0] >= 0.5 && cols[0] <= 16 && (cols[0] * 2) % 1 === 0) {
        // 첫 열이 일수(0.5 ~ 16)인 경우
        const dKey = String(cols[0]);
        updated[dKey] = {
          basic: Math.round(cols[1] || 0),
          ot: Math.round(cols[2] || 0),
          night: Math.round(cols[3] || 0),
          juhyu: Math.round(cols[4] || 0),
          extra: Math.round(cols[5] || 0),
        };
        appliedRows++;
      } else if (cols.length >= 5 && idx < DAY_STEPS.length) {
        // 첫 열부터 바로 기본급, 연장, 야간, 주휴, 추가 5개 열인 경우
        const dKey = String(DAY_STEPS[idx]);
        updated[dKey] = {
          basic: Math.round(cols[0] || 0),
          ot: Math.round(cols[1] || 0),
          night: Math.round(cols[2] || 0),
          juhyu: Math.round(cols[3] || 0),
          extra: Math.round(cols[4] || 0),
        };
        appliedRows++;
      }
    });

    if (appliedRows === 0) {
      alert('유효한 조견표 숫자 행을 인식하지 못했습니다. 엑셀에서 숫자 영역을 복사해 주세요.');
      return;
    }

    setPayTable(updated);
    setShowPasteBox(false);
    setPasteText('');
    alert(`총 ${appliedRows}개 일수 구간의 조견표가 자동으로 채워졌습니다!`);
  };

  // 인상률(%) 일괄 계산
  const handleApplyIncreaseRate = () => {
    const rate = parseFloat(increaseRate);
    if (isNaN(rate) || rate === 0) {
      alert('유효한 인상률(%)을 입력해 주세요. (예: 4.5)');
      return;
    }
    if (!confirm(`현재 표의 모든 금액에 ${rate}% 인상을 일괄 계산하시겠습니까? (10원 단위 반올림)`)) {
      return;
    }

    const factor = 1 + rate / 100;
    const round10 = (v: number) => Math.round((v * factor) / 10) * 10;

    const updated: PrivatePayTableMap = {};
    DAY_STEPS.forEach(d => {
      const k = String(d);
      const cur = payTable[k] || DEFAULT_PRIVATE_PAY_TABLE[d];
      updated[k] = {
        basic: round10(cur.basic),
        ot: round10(cur.ot),
        night: round10(cur.night),
        juhyu: round10(cur.juhyu),
        extra: round10(cur.extra),
      };
    });

    setPayTable(updated);
    setJeolWage(prev => Math.round(prev * factor));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-[28px] shadow-2xl w-full ${
          activeTab === 'PRIVATE' ? 'max-w-5xl' : 'max-w-lg'
        } max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 transition-all`}
      >
        {/* 상단 헤더 & 탭 */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Coins className="text-orange-500" size={28} strokeWidth={2.5} />
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              임금 및 조견표 설정
            </h2>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('PUBLIC')}
              className={`px-4 py-2 rounded-lg font-black text-[14px] transition-all ${
                activeTab === 'PUBLIC'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              공공관리제 시급
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PRIVATE')}
              className={`px-4 py-2 rounded-lg font-black text-[14px] transition-all ${
                activeTab === 'PRIVATE'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              민영제 조견표·시급
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 bg-white border border-slate-200 p-1.5 rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        {/* 탭 1: 공공관리제 시급 설정 */}
        {activeTab === 'PUBLIC' && (
          <form onSubmit={handlePublicSubmit} className="p-6 overflow-y-auto flex flex-col gap-5">
            {payConfig?.publicRules && payConfig.publicRules.length > 0 && (
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4">
                <div className="text-xs font-extrabold text-indigo-900 mb-2">
                  📌 등록된 공공관리제 시급 적용 이력
                </div>
                <div className="flex flex-wrap gap-2">
                  {payConfig.publicRules.map(r => (
                    <div
                      key={r.startYearMonth}
                      className="inline-flex items-center gap-2 bg-white border border-indigo-200 px-3 py-1.5 rounded-xl text-[13px] font-black text-slate-800 shadow-2xs"
                    >
                      <span className="text-indigo-600">{r.startYearMonth}~</span>
                      <span>{r.hourlyWage.toLocaleString()}원</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule('PUBLIC', r.startYearMonth)}
                        className="text-slate-400 hover:text-red-500"
                        title="이력 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-2">
                새로운 공공관리제 시급 (원)
              </label>
              <input
                type="text"
                required
                value={pubWage ? pubWage.toLocaleString() : ''}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setPubWage(Number(val));
                }}
                className="w-full border border-slate-300 p-4 rounded-xl focus:ring-2 focus:ring-indigo-500 text-[22px] font-black outline-none text-slate-900 shadow-xs text-center tracking-wider"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                  <Calendar size={17} className="text-indigo-600" /> 적용 시작 연월 지정
                </label>
                <input
                  type="month"
                  disabled={pubApplyAllPast}
                  value={pubStartYm}
                  onChange={e => setPubStartYm(e.target.value)}
                  className="border border-slate-300 bg-white px-3 py-2 rounded-xl font-black text-[15px] text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
                />
              </div>
              <p className="text-[12.5px] font-bold text-slate-500 leading-relaxed">
                • 선택한 <strong className="text-indigo-600">{pubStartYm}월</strong> 이전의 과거 배차표 시급은 수정되지 않고 안전하게 보존됩니다.
              </p>

              <hr className="border-slate-200" />

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pubApplyAllPast}
                  onChange={e => setPubApplyAllPast(e.target.checked)}
                  className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                />
                <span className="text-[13.5px] font-extrabold text-slate-700">
                  과거 모든 기록에도 일괄 소급 적용하기
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 text-[16px] rounded-xl transition-all shadow-md active:scale-95"
            >
              {isSaving ? '저장 중...' : '공공관리제 시급 저장'}
            </button>
          </form>
        )}

        {/* 탭 2: 민영제 조견표 및 시급 설정 */}
        {activeTab === 'PRIVATE' && (
          <form
            onSubmit={handlePrivateSubmit}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            {/* 상단 컨트롤 바 */}
            <div className="p-5 bg-white border-b border-slate-200 flex flex-col gap-3 shrink-0">
              {payConfig?.privateRules && payConfig.privateRules.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 bg-orange-50/70 border border-orange-200 px-3.5 py-2 rounded-xl">
                  <span className="text-xs font-extrabold text-orange-900 mr-1">
                    📌 저장된 조견표 버전(클릭 시 불러오기):
                  </span>
                  {payConfig.privateRules.map(r => (
                    <div
                      key={r.startYearMonth}
                      className="inline-flex items-center gap-1.5 bg-white border border-orange-300 px-2.5 py-1 rounded-lg text-[12.5px] font-black text-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPrivStartYm(r.startYearMonth === '2000-01' ? currentYm : r.startYearMonth);
                          setJeolWage(r.jeolHourlyWage);
                          setSafeBonus(r.safeBonus ?? 60000);
                          setPayTable(JSON.parse(JSON.stringify(r.payTable)));
                        }}
                        className="hover:text-orange-600 flex items-center gap-1"
                      >
                        <CheckCircle2 size={13} className="text-orange-500" />
                        <span>
                          {r.startYearMonth === '2000-01' ? '기본(전체)' : `${r.startYearMonth}~`}
                        </span>
                        <span className="text-slate-500 font-bold">
                          (절시급 {r.jeolHourlyWage.toLocaleString()}원)
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule('PRIVATE', r.startYearMonth)}
                        className="text-slate-400 hover:text-red-600 ml-1"
                        title="이 버전 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. 적용 시작월 */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-600">적용 시작 연월</span>
                    <input
                      type="month"
                      disabled={privApplyAllPast}
                      value={privStartYm}
                      onChange={e => setPrivStartYm(e.target.value)}
                      className="border border-slate-300 bg-white px-2.5 py-1 rounded-lg font-black text-[14px] text-orange-600 outline-none disabled:opacity-40"
                    />
                  </div>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={privApplyAllPast}
                      onChange={e => setPrivApplyAllPast(e.target.checked)}
                      className="w-4 h-4 accent-orange-500 rounded"
                    />
                    <span className="text-[12px] font-bold text-slate-600">
                      과거 모든 기록에도 일괄 적용
                    </span>
                  </label>
                </div>

                {/* 2. 민영 절근로 시급 & 무사고 */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11.5px] font-extrabold text-slate-600 mb-1">
                      절근로 시급 (원)
                    </label>
                    <input
                      type="text"
                      value={jeolWage ? jeolWage.toLocaleString() : ''}
                      onChange={e =>
                        setJeolWage(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)
                      }
                      className="w-full bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg font-black text-[15px] text-slate-800 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-extrabold text-slate-600 mb-1">
                      무사고 수당 (원)
                    </label>
                    <input
                      type="text"
                      value={safeBonus ? safeBonus.toLocaleString() : ''}
                      onChange={e =>
                        setSafeBonus(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)
                      }
                      className="w-full bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg font-black text-[15px] text-slate-800 text-center"
                    />
                  </div>
                </div>

                {/* 3. 빠른 편집 도구 (엑셀 붙여넣기 & 인상률 계산) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowPasteBox(!showPasteBox)}
                      className="flex-1 py-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[12.5px] rounded-lg flex items-center justify-center gap-1 transition-all active:scale-95"
                    >
                      <ClipboardPaste size={14} /> 엑셀 붙여넣기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('조견표를 초기 기본값으로 되돌리시겠습니까?')) {
                          setPayTable(getDefaultTableMap());
                          setJeolWage(17201);
                          setSafeBonus(60000);
                        }
                      }}
                      className="py-1.5 px-2.5 bg-white hover:bg-slate-200 text-slate-600 border border-slate-300 font-extrabold text-[12px] rounded-lg flex items-center gap-1"
                      title="기본 조견표로 복원"
                    >
                      <RotateCcw size={13} /> 기본값
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={increaseRate}
                        onChange={e => setIncreaseRate(e.target.value)}
                        placeholder="인상률 (예: 4.5)"
                        className="w-full bg-white border border-slate-300 pl-2.5 pr-6 py-1 rounded-lg font-bold text-[12.5px] text-slate-800"
                      />
                      <Percent
                        size={12}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyIncreaseRate}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-[12px] rounded-lg"
                    >
                      일괄 계산
                    </button>
                  </div>
                </div>
              </div>

              {/* 엑셀 붙여넣기 입력창 */}
              {showPasteBox && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-col gap-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[12.5px] font-extrabold text-indigo-950">
                    <span>
                      💡 엑셀 조견표에서 0.5일~16일의 [기본급 | 연장 | 야간 | 주휴 | 추가] 영역을 복사(Ctrl+C)해 아래에 붙여넣으세요.
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPasteBox(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder="여기에 Ctrl+V 로 붙여넣으세요..."
                    className="w-full p-2.5 bg-white border border-indigo-300 rounded-lg text-[12.5px] font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleApplyPaste}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[13px] rounded-lg shadow-xs"
                    >
                      표에 즉시 반영하기
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 중앙: 0.5일 ~ 16일 조견표 편집 테이블 */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100">
              <div className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-xs">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-800 text-white sticky top-0 z-10">
                    <tr className="h-[38px] text-[13px] font-extrabold">
                      <th className="w-[70px] text-center border-r border-slate-700">일수</th>
                      <th className="text-center border-r border-slate-700">기본급</th>
                      <th className="text-center border-r border-slate-700">연장근로</th>
                      <th className="text-center border-r border-slate-700">야간근로</th>
                      <th className="text-center border-r border-slate-700">주휴수당</th>
                      <th className="text-center border-r border-slate-700">추가수당</th>
                      <th className="w-[125px] text-center bg-slate-900">합계 (무사고 제외)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {DAY_STEPS.map(d => {
                      const dKey = String(d);
                      const row = payTable[dKey] || {
                        basic: 0,
                        ot: 0,
                        night: 0,
                        juhyu: 0,
                        extra: 0,
                      };
                      const rowSum =
                        (row.basic || 0) +
                        (row.ot || 0) +
                        (row.night || 0) +
                        (row.juhyu || 0) +
                        (row.extra || 0);
                      const isIntegerDay = d % 1 === 0;

                      return (
                        <tr
                          key={dKey}
                          className={`h-[36px] ${
                            isIntegerDay ? 'bg-orange-50/30' : 'bg-white'
                          } hover:bg-blue-50/50`}
                        >
                          <td className="text-center font-black text-[14px] text-slate-800 border-r border-slate-200 bg-slate-50">
                            {d}일
                          </td>
                          {(['basic', 'ot', 'night', 'juhyu', 'extra'] as const).map(field => (
                            <td key={field} className="p-1 border-r border-slate-200">
                              <input
                                type="text"
                                value={row[field] ? row[field].toLocaleString() : '0'}
                                onChange={e => handleCellChange(dKey, field, e.target.value)}
                                className="w-full h-[28px] px-2 text-right font-bold text-[13.5px] text-slate-800 bg-transparent focus:bg-white focus:ring-2 focus:ring-orange-500 rounded outline-none"
                              />
                            </td>
                          ))}
                          <td className="px-3 text-right font-black text-[14px] text-indigo-700 bg-slate-50/80">
                            {rowSum.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 하단 저장 버튼 */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-[15px]"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl text-[15.5px] shadow-md active:scale-95 transition-all"
              >
                {isSaving ? '저장 중...' : '민영제 조견표·시급 설정 저장'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}