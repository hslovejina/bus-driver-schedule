// 파일 위치: app/main/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, BarChartBig, Settings, Smartphone } from 'lucide-react';
import RosterView from '@/components/RosterView';
import StatisticsView from '@/components/StatisticsView';
import SettingsView from '@/components/SettingsView';

const TABS = [
  { id: 'roster', label: '배차', icon: CalendarDays },
  { id: 'statistics', label: '통계', icon: BarChartBig },
  { id: 'settings', label: '설정', icon: Settings },
];

export default function MainPage() {
  const [activeTab, setActiveTab] = useState('roster');
  const [isLandscape, setIsLandscape] = useState(true);
  const [cssRotateMode, setCssRotateMode] = useState<'NONE' | 'LANDSCAPE' | 'PORTRAIT'>('NONE');

  // 관리자 페이지에서 돌아왔을 때 설정 탭 띄우기
  useEffect(() => {
    if (sessionStorage.getItem('returnToSettings') === 'true') {
      setActiveTab('settings');
      sessionStorage.removeItem('returnToSettings');
    }
  }, []);

  // 현재 화면의 가로/세로 상태 감지
  useEffect(() => {
    const updateOrientationState = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (cssRotateMode === 'LANDSCAPE') {
        setIsLandscape(true);
      } else if (cssRotateMode === 'PORTRAIT') {
        setIsLandscape(false);
      } else {
        setIsLandscape(w >= h);
      }
    };

    updateOrientationState();
    window.addEventListener('resize', updateOrientationState);
    window.addEventListener('orientationchange', updateOrientationState);
    return () => {
      window.removeEventListener('resize', updateOrientationState);
      window.removeEventListener('orientationchange', updateOrientationState);
    };
  }, [cssRotateMode]);

  // 가로모드 <-> 세로모드 스위치 핸들러
  const handleToggleOrientation = useCallback(async () => {
    const targetLandscape = !isLandscape;
    const scr = typeof window !== 'undefined' ? (window.screen as any) : null;

    // 이미 CSS 강제 회전 중이었다면 해제 먼저 시도
    if (cssRotateMode !== 'NONE') {
      setCssRotateMode('NONE');
    }

    try {
      // 1차 시도: PWA(standalone) 환경에서는 전체화면 없이 바로 방향 전환 가능
      if (scr?.orientation?.lock) {
        await scr.orientation.lock(targetLandscape ? 'landscape' : 'portrait');
        sessionStorage.setItem('preferredOrientation', targetLandscape ? 'LANDSCAPE' : 'PORTRAIT');
        setIsLandscape(targetLandscape);
        return;
      }
    } catch {
      // 일반 브라우저 탭에서는 전체화면 진입 후 방향 잠금 시도
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        if (scr?.orientation?.lock) {
          await scr.orientation.lock(targetLandscape ? 'landscape' : 'portrait');
          sessionStorage.setItem('preferredOrientation', targetLandscape ? 'LANDSCAPE' : 'PORTRAIT');
          setIsLandscape(targetLandscape);
          return;
        }
      } catch {
        // 기기 자동회전 잠금 또는 iOS 등 API 미지원 환경일 경우 CSS 화면 회전 스위치로 작동
        const physicalLandscape = window.innerWidth >= window.innerHeight;
        if (targetLandscape && !physicalLandscape) {
          setCssRotateMode('LANDSCAPE');
          setIsLandscape(true);
        } else if (!targetLandscape && physicalLandscape) {
          setCssRotateMode('PORTRAIT');
          setIsLandscape(false);
        } else {
          setCssRotateMode('NONE');
          setIsLandscape(targetLandscape);
        }
      }
    }
  }, [isLandscape, cssRotateMode]);

  // 기기 자체 회전이 막힌 환경을 위한 CSS 회전 래퍼 스타일
  const wrapperClass =
    cssRotateMode === 'LANDSCAPE'
      ? 'fixed top-0 left-0 w-[100dvh] h-[100dvw] origin-top-left rotate-90 translate-x-[100dvw] flex flex-col bg-white font-sans overscroll-none z-[100]'
      : cssRotateMode === 'PORTRAIT'
      ? 'fixed top-0 left-0 w-[100dvh] h-[100dvw] origin-top-left -rotate-90 translate-y-[100dvh] flex flex-col bg-white font-sans overscroll-none z-[100]'
      : 'flex flex-col w-full h-[100dvh] bg-white font-sans overscroll-none';

  return (
    <div className={wrapperClass}>
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {activeTab === 'roster' && <RosterView />}
        {activeTab === 'statistics' && <StatisticsView />}
        {activeTab === 'settings' && <SettingsView />}
      </div>

      {/* 하단 탭 바 (배차 | 통계 | 설정 + 우측 가로/세로 전환 스위치) */}
      <nav className="w-full shrink-0 flex items-center h-[38px] xl:h-[46px] bg-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(0,0,0,0.03)] z-50 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 h-full flex flex-row items-center justify-center gap-1.5 xl:gap-2 transition-colors ${
                isActive
                  ? 'text-blue-600 bg-blue-50/50'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50/50'
              }`}
            >
              <Icon
                size={17}
                strokeWidth={isActive ? 2.5 : 2}
                className={`xl:w-[20px] xl:h-[20px] shrink-0 ${isActive ? 'drop-shadow-xs' : ''}`}
              />
              <span
                className={`text-[13px] xl:text-[14px] tracking-tight leading-none ${
                  isActive ? 'font-black' : 'font-bold'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* 설정 우측: 가로모드 / 세로모드 전환 스위치 */}
        <div className="h-full flex items-center px-2 sm:px-3 border-l border-slate-200 bg-slate-50/60 shrink-0">
          <button
            type="button"
            onClick={handleToggleOrientation}
            title="클릭하여 가로모드 / 세로모드 전환"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-300 bg-white hover:bg-slate-100 active:scale-95 transition-all shadow-2xs cursor-pointer"
          >
            <Smartphone
              size={14}
              strokeWidth={2.5}
              className={`transition-transform duration-200 ${
                isLandscape ? 'rotate-90 text-blue-600' : 'rotate-0 text-indigo-600'
              }`}
            />
            <span className="text-[11.5px] xl:text-[12.5px] font-black text-slate-700 whitespace-nowrap leading-none">
              {isLandscape ? '가로모드' : '세로모드'}
            </span>
            <div
              className={`w-6 h-3.5 rounded-full p-0.5 transition-colors flex items-center ${
                isLandscape ? 'bg-blue-600 justify-end' : 'bg-indigo-500 justify-start'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
            </div>
          </button>
        </div>
      </nav>
    </div>
  );
}