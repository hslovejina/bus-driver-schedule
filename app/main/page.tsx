// 파일 위치: app/main/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { CalendarDays, BarChartBig, Settings } from 'lucide-react';
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

  // 관리자 페이지에서 돌아왔을 때 설정 탭 띄우기
  useEffect(() => {
    if (sessionStorage.getItem('returnToSettings') === 'true') {
      setActiveTab('settings');
      sessionStorage.removeItem('returnToSettings');
    }
  }, []);

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-white font-sans overscroll-none">
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {activeTab === 'roster' && <RosterView />}
        {activeTab === 'statistics' && <StatisticsView />}
        {activeTab === 'settings' && <SettingsView />}
      </div>

      {/* 스마트폰 가로모드 공간 확보를 위해 슬림화 및 가로 배열(아이콘 + 명칭) 적용 */}
      <nav className="w-full shrink-0 flex items-center h-[38px] xl:h-[46px] bg-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(0,0,0,0.03)] z-50 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
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
      </nav>
    </div>
  );
}