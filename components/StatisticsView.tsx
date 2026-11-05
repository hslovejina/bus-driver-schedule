// 파일 위치: components/StatisticsView.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, BarChartBig, CalendarDays, RotateCcw, Download } from 'lucide-react';
import {
  calculateRowStats,
  setRuntimePayConfig,
  DEFAULT_PLACEHOLDER_NAMES,
  isNormalPrivateShift,
  type DriverInfo,
} from '../utils/calculator';
import type { BusGroup } from '../hooks/useRosterData';
import { useMobileViewport } from '../hooks/useMobileViewport';

interface MonthlyMetric {
  hasWorked: boolean;
  workDays: number;
  sojeong: number;
  jeolnal: number;
  overtime: number;
  extraTotal: number;
  bokgyeok: number;
  support: number;
  longShift: number;
}

interface DriverYearlyStat {
  name: string;
  busNo: string;
  team: 'A' | 'B';
  lastSeenMonth: number;
  groupOrder: number;
  driverOrder: number;
  workedMonthCount: number;
  isFullYear: boolean;
  monthly: Record<number, MonthlyMetric>;
  totals: {
    workDays: number;
    sojeong: number;
    jeolnal: number;
    overtime: number;
    extraTotal: number;
    bokgyeok: number;
    support: number;
    longShift: number;
  };
}

type SortKey =
  | { type: 'DEFAULT' }
  | { type: 'TOTAL'; field: keyof DriverYearlyStat['totals'] }
  | { type: 'MONTH'; month: number; field: keyof MonthlyMetric };

export default function StatisticsView() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [route, setRoute] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [rostersData, setRostersData] = useState<any[]>([]);
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [allRoutes, setAllRoutes] = useState<{ name: string; routeType: string }[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [defaultWage, setDefaultWage] = useState<number>(16911);

  const [sortKey, setSortKey] = useState<SortKey>({ type: 'DEFAULT' });
  const [sortDirection, setSortDirection] = useState<'DESC' | 'ASC'>('DESC');

  const { containerRef, scale, resetScale } = useMobileViewport();

  const monthsArray = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  useEffect(() => {
    const fetchUserRoute = async () => {
      const userStr = localStorage.getItem('currentUser');
      if (!userStr) {
        setRoute('미지정');
        return;
      }
      const localUser = JSON.parse(userStr);

      try {
        const res = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'GET_LATEST_INFO', empId: localUser.empId }),
        });
        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem('currentUser', JSON.stringify(data.user));
          setRoute(data.user.route || '미지정');
        } else {
          setRoute(localUser.route || '미지정');
        }
      } catch {
        setRoute(localUser.route || '미지정');
      }
    };
    fetchUserRoute();
  }, []);

  useEffect(() => {
    if (!route || route === '미지정') {
      setIsLoading(false);
      return;
    }

    const fetchYearlyData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/roster?route=${encodeURIComponent(route)}&year=${year}`);
        if (res.ok) {
          const data = await res.json();
          setRostersData(data.rosters || []);
          setRouteInfo(data.routeInfo || null);
          setAllRoutes(data.allRoutes || []);
          setHolidays(data.holidays || {});
          setDefaultWage(data.defaultHourlyWage || 16911);
          if (data.payConfig) {
            setRuntimePayConfig(data.payConfig);
          }
        }
      } catch (err) {
        console.error('연간 통계 데이터 로딩 실패:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchYearlyData();
  }, [route, year]);

  const isPrivate = routeInfo?.routeType === 'PRIVATE';

  const handleSort = (newKey: SortKey) => {
    if (newKey.type === 'DEFAULT') {
      setSortKey({ type: 'DEFAULT' });
      setSortDirection('DESC');
      return;
    }

    if (
      sortKey.type === newKey.type &&
      ((newKey.type === 'TOTAL' && sortKey.type === 'TOTAL' && sortKey.field === newKey.field) ||
        (newKey.type === 'MONTH' &&
          sortKey.type === 'MONTH' &&
          sortKey.month === newKey.month &&
          sortKey.field === newKey.field))
    ) {
      setSortDirection(prev => (prev === 'DESC' ? 'ASC' : 'DESC'));
    } else {
      setSortKey(newKey);
      setSortDirection('DESC');
    }
  };

  const { rawFullYearDrivers, rawPartialYearDrivers, activeMonths, busOrderMap } = useMemo(() => {
    const rosterByMonth: Record<string, { rosterData: BusGroup[]; hourlyWage: number }> = {};
    rostersData.forEach((r: any) => {
      rosterByMonth[r.yearMonth] = {
        rosterData: Array.isArray(r.rosterData) ? r.rosterData : [],
        hourlyWage: r.hourlyWage || defaultWage,
      };
    });

    const getDriverLastDayWork = (targetYear: number, targetMonth: number, driverName: string): string => {
      const ym = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      const mRoster = rosterByMonth[ym]?.rosterData;
      if (!mRoster) return '';
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();

      for (const group of mRoster) {
        for (const drv of group.drivers) {
          if (drv.name?.trim() === driverName) {
            const w = drv.schedules?.[String(lastDay)];
            if (w) return w;
          }
        }
      }
      return '';
    };

    const driverMap = new Map<string, DriverYearlyStat>();
    const activeMonthsSet = new Set<number>();
    const longShiftsSet = new Set<string>(routeInfo?.longShifts || []);
    const routeType = routeInfo?.routeType || 'PUBLIC';

    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${String(m).padStart(2, '0')}`;
      const monthEntry = rosterByMonth[ym];
      if (!monthEntry || !monthEntry.rosterData || monthEntry.rosterData.length === 0) continue;

      const daysInMonth = new Date(year, m, 0).getDate();
      const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

      let numericBusCount = 0;
      monthEntry.rosterData.forEach(g => {
        if (/^\d+$/.test(g.busNo.trim())) numericBusCount++;
      });
      const maxShiftCount = routeInfo?.weekdayCount || numericBusCount || 50;

      const monthDrivers = new Map<
        string,
        {
          mergedSchedules: Record<string, string>;
          busNo: string;
          team: 'A' | 'B';
          groupOrder: number;
          driverOrder: number;
        }
      >();

      monthEntry.rosterData.forEach((group, bIdx) => {
        const cleanBusNo = group.busNo.trim();
        group.drivers.forEach((drv, dIdx) => {
          const name = drv.name?.trim() || '';
          if (!name) return;

          const schedKeys = Object.keys(drv.schedules || {});
          if (DEFAULT_PLACEHOLDER_NAMES.includes(name) && schedKeys.length === 0) return;

          const existing = monthDrivers.get(name);
          const team: 'A' | 'B' = dIdx === 0 ? 'A' : 'B';

          if (!existing) {
            monthDrivers.set(name, {
              mergedSchedules: { ...(drv.schedules || {}) },
              busNo: cleanBusNo,
              team,
              groupOrder: bIdx,
              driverOrder: dIdx,
            });
          } else {
            monthDrivers.set(name, {
              mergedSchedules: { ...existing.mergedSchedules, ...(drv.schedules || {}) },
              busNo: cleanBusNo,
              team,
              groupOrder: bIdx,
              driverOrder: dIdx,
            });
          }
        });
      });

      monthDrivers.forEach((info, name) => {
        const prevYear = m === 1 ? year - 1 : year;
        const prevMonth = m === 1 ? 12 : m - 1;
        const prevMonthLastDayWork = isPrivate ? getDriverLastDayWork(prevYear, prevMonth, name) : '';

        const driverObj: DriverInfo = {
          name,
          schedules: info.mergedSchedules,
        };

        const rowStats = calculateRowStats(
          driverObj,
          year,
          m,
          daysArray,
          holidays,
          monthEntry.hourlyWage,
          routeType,
          prevMonthLastDayWork,
          allRoutes,
          maxShiftCount
        );

        let supportCount = 0;
        let longShiftCount = 0;

        daysArray.forEach(d => {
          const rawWork = info.mergedSchedules[String(d)] || '';
          const work = rawWork.trim();
          if (!work) return;

          if (isPrivate) {
            const isRestOrLeave = ['신청휴무', '휴무', 'x', 'X', '-', '연차', '연', '조퇴', '근무'].includes(work);
            if (!isRestOrLeave && !isNormalPrivateShift(work, allRoutes, maxShiftCount)) {
              supportCount++;
            }
          } else {
            if (longShiftsSet.has(work)) {
              longShiftCount++;
            }
          }
        });

        const hasWorked = rowStats.totalWorkDays > 0 || supportCount > 0;
        if (hasWorked) {
          activeMonthsSet.add(m);
        }

        let record = driverMap.get(name);
        if (!record) {
          record = {
            name,
            busNo: info.busNo,
            team: info.team,
            lastSeenMonth: m,
            groupOrder: info.groupOrder,
            driverOrder: info.driverOrder,
            workedMonthCount: 0,
            isFullYear: false,
            monthly: {},
            totals: {
              workDays: 0,
              sojeong: 0,
              jeolnal: 0,
              overtime: 0,
              extraTotal: 0,
              bokgyeok: 0,
              support: 0,
              longShift: 0,
            },
          };
          driverMap.set(name, record);
        }

        if (hasWorked || m >= record.lastSeenMonth) {
          record.busNo = info.busNo;
          record.team = info.team;
          record.lastSeenMonth = m;
          record.groupOrder = info.groupOrder;
          record.driverOrder = info.driverOrder;
        }

        if (hasWorked) {
          const metric: MonthlyMetric = {
            hasWorked: true,
            workDays: rowStats.totalWorkDays || 0,
            sojeong: rowStats.targetSojeong || 0,
            jeolnal: rowStats.jeolnalTotal || 0,
            overtime: rowStats.overtimeDays || 0,
            extraTotal: rowStats.extraTotal || 0,
            bokgyeok: rowStats.bokgyeokCount || 0,
            support: supportCount,
            longShift: longShiftCount,
          };

          record.monthly[m] = metric;
          record.totals.workDays += metric.workDays;
          record.totals.sojeong += metric.sojeong;
          record.totals.jeolnal += metric.jeolnal;
          record.totals.overtime += metric.overtime;
          record.totals.extraTotal += metric.extraTotal;
          record.totals.bokgyeok += metric.bokgyeok;
          record.totals.support += metric.support;
          record.totals.longShift += metric.longShift;
        }
      });
    }

    const activeMonthsList = Array.from(activeMonthsSet).sort((a, b) => a - b);

    const latestActiveMonth = activeMonthsList.length > 0 ? activeMonthsList[activeMonthsList.length - 1] : 0;
    const latestYm = `${year}-${String(latestActiveMonth).padStart(2, '0')}`;
    const latestRoster = rosterByMonth[latestYm]?.rosterData || [];

    const orderMap = new Map<string, number>();
    latestRoster.forEach((g, idx) => {
      const bNo = g.busNo.trim();
      if (!orderMap.has(bNo)) {
        orderMap.set(bNo, idx);
      }
    });

    const allDrivers = Array.from(driverMap.values()).filter(
      d => d.totals.workDays > 0 || d.totals.support > 0
    );

    allDrivers.forEach(drv => {
      let count = 0;
      activeMonthsList.forEach(m => {
        if (drv.monthly[m]?.hasWorked) count++;
      });
      drv.workedMonthCount = count;
      drv.isFullYear = activeMonthsList.length > 0 && count === activeMonthsList.length;
    });

    return {
      rawFullYearDrivers: allDrivers.filter(d => d.isFullYear),
      rawPartialYearDrivers: allDrivers.filter(d => !d.isFullYear),
      activeMonths: activeMonthsList,
      busOrderMap: orderMap,
    };
  }, [rostersData, routeInfo, allRoutes, holidays, defaultWage, year, isPrivate]);

  const { fullYearDrivers, partialYearDrivers } = useMemo(() => {
    const sortDrivers = (list: DriverYearlyStat[]) => {
      return [...list].sort((a, b) => {
        if (sortKey.type !== 'DEFAULT') {
          let valA = 0;
          let valB = 0;

          if (sortKey.type === 'TOTAL') {
            valA = Number(a.totals[sortKey.field] || 0);
            valB = Number(b.totals[sortKey.field] || 0);
          } else if (sortKey.type === 'MONTH') {
            valA = Number(a.monthly[sortKey.month]?.[sortKey.field] || 0);
            valB = Number(b.monthly[sortKey.month]?.[sortKey.field] || 0);
          }

          if (valA !== valB) {
            return sortDirection === 'DESC' ? valB - valA : valA - valB;
          }
        }

        if (isPrivate) {
          if (a.team !== b.team) return a.team === 'A' ? -1 : 1;
          const orderA = busOrderMap.get(a.busNo) ?? a.groupOrder;
          const orderB = busOrderMap.get(b.busNo) ?? b.groupOrder;
          if (orderA !== orderB) return orderA - orderB;
          if (a.busNo !== b.busNo) return a.busNo.localeCompare(b.busNo, 'ko', { numeric: true });
          return a.lastSeenMonth - b.lastSeenMonth;
        } else {
          const isSpA = a.busNo.toUpperCase() === 'SP';
          const isSpB = b.busNo.toUpperCase() === 'SP';
          if (isSpA !== isSpB) return isSpA ? 1 : -1;

          if (!isSpA && !isSpB) {
            const busIdxA = busOrderMap.get(a.busNo) ?? a.groupOrder + 100;
            const busIdxB = busOrderMap.get(b.busNo) ?? b.groupOrder + 100;
            if (busIdxA !== busIdxB) return busIdxA - busIdxB;
            if (a.driverOrder !== b.driverOrder) return a.driverOrder - b.driverOrder;
          }

          if (a.lastSeenMonth !== b.lastSeenMonth) return b.lastSeenMonth - a.lastSeenMonth;
          if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
          return a.driverOrder - b.driverOrder;
        }
      });
    };

    return {
      fullYearDrivers: sortDrivers(rawFullYearDrivers),
      partialYearDrivers: sortDrivers(rawPartialYearDrivers),
    };
  }, [rawFullYearDrivers, rawPartialYearDrivers, busOrderMap, isPrivate, sortKey, sortDirection]);

  const totalDriverCount = fullYearDrivers.length + partialYearDrivers.length;
  const totalColSpan = isPrivate ? 3 + 4 + 12 * 3 : 2 + 6 + 12 * 6;
  const stickyColCount = isPrivate ? 7 : 8;

  const handleExportExcel = async () => {
    if (totalDriverCount === 0) {
      alert('저장할 통계 데이터가 없습니다.');
      return;
    }
    const { exportStatisticsExcel } = await import('../utils/excelExporter');
    await exportStatisticsExcel({
      year,
      route: route && route !== '미지정' ? route : '',
      isPrivate,
      fullYearDrivers,
      partialYearDrivers,
    });
  };

  const renderPrivateRow = (
    drv: DriverYearlyStat,
    idx: number,
    list: DriverYearlyStat[],
    isPartialSection: boolean
  ) => {
    const isLastInSection = idx === list.length - 1;
    const isTeamBoundary = drv.team === 'A' && list[idx + 1]?.team === 'B';
    const borderBottom =
      isLastInSection || isTeamBoundary
        ? 'border-b-[2.5px] border-b-slate-700'
        : 'border-b border-b-slate-200';
    const stickyBg = isPartialSection
      ? 'bg-amber-50 group-hover:bg-amber-100'
      : 'bg-white group-hover:bg-slate-50';

    return (
      <tr key={drv.name} className={`h-[26px] transition-colors group`}>
        <td
          className={`sticky left-0 z-30 w-[24px] min-w-[24px] py-0 px-0 text-center font-black text-[12px] text-slate-800 border-l-[2.5px] border-l-slate-700 border-r border-r-slate-300 ${
            drv.team === 'A' ? 'bg-sky-50' : 'bg-indigo-50'
          } ${borderBottom}`}
        >
          {drv.team}
        </td>
        <td
          className={`sticky left-[24px] z-30 w-[38px] min-w-[38px] py-0 px-0 text-center font-black text-[12.5px] text-slate-800 tracking-tighter border-r border-r-slate-300 ${stickyBg} ${borderBottom}`}
        >
          {drv.busNo}
        </td>
        <td
          className={`sticky left-[62px] z-30 w-[52px] min-w-[52px] py-0 px-0 text-center font-extrabold text-[12.5px] text-slate-900 tracking-tighter whitespace-nowrap border-r-[2px] border-r-slate-500 ${stickyBg} ${borderBottom}`}
        >
          {drv.name}
        </td>

        <td
          className={`sticky left-[114px] z-30 w-[30px] min-w-[30px] py-0 px-0 text-center font-black text-[12.5px] tracking-tighter ${
            drv.totals.workDays > 0 ? 'text-slate-900' : 'text-slate-300'
          } bg-emerald-50 border-r border-r-emerald-200 ${borderBottom}`}
        >
          {drv.totals.workDays > 0 ? drv.totals.workDays : '-'}
        </td>
        <td
          className={`sticky left-[144px] z-30 w-[24px] min-w-[24px] py-0 px-0 text-center font-black text-[12.5px] tracking-tighter ${
            drv.totals.jeolnal > 0 ? 'text-rose-600' : 'text-slate-300'
          } bg-emerald-50 border-r border-r-emerald-200 ${borderBottom}`}
        >
          {drv.totals.jeolnal > 0 ? drv.totals.jeolnal : '-'}
        </td>
        <td
          className={`sticky left-[168px] z-30 w-[28px] min-w-[28px] py-0 px-0 text-center font-black text-[12.5px] tracking-tighter ${
            drv.totals.bokgyeok > 0 ? 'text-purple-700' : 'text-slate-300'
          } bg-emerald-50 border-r border-r-emerald-200 ${borderBottom}`}
        >
          {drv.totals.bokgyeok > 0 ? drv.totals.bokgyeok : '-'}
        </td>
        <td
          className={`sticky left-[196px] z-30 w-[28px] min-w-[28px] py-0 px-0 text-center font-black text-[12.5px] tracking-tighter ${
            drv.totals.support > 0 ? 'text-emerald-800' : 'text-slate-300'
          } bg-emerald-100 border-r-[2.5px] border-r-slate-700 ${borderBottom}`}
        >
          {drv.totals.support > 0 ? drv.totals.support : '-'}
        </td>

        {monthsArray.map(m => {
          const stat = drv.monthly[m];
          const hasData = !!stat?.hasWorked;
          const isLastM = m === 12;
          return (
            <React.Fragment key={m}>
              <td
                className={`w-[28px] min-w-[28px] py-0 px-0 text-center font-bold text-[12.5px] tracking-tighter border-r border-r-slate-200 ${
                  hasData && stat.workDays > 0
                    ? 'text-slate-900 bg-white'
                    : 'text-slate-300 bg-slate-50/40'
                } ${borderBottom}`}
              >
                {hasData && stat.workDays > 0 ? stat.workDays : '-'}
              </td>
              <td
                className={`w-[24px] min-w-[24px] py-0 px-0 text-center font-bold text-[12px] tracking-tighter border-r border-r-slate-200 ${
                  hasData
                    ? stat.jeolnal > 0
                      ? 'text-rose-600 font-black bg-rose-50/20'
                      : 'text-slate-300 bg-white'
                    : 'text-slate-300 bg-slate-50/40'
                } ${borderBottom}`}
              >
                {hasData && stat.jeolnal > 0 ? stat.jeolnal : '-'}
              </td>
              <td
                className={`w-[28px] min-w-[28px] py-0 px-0 text-center font-bold text-[12px] tracking-tighter ${
                  isLastM ? 'border-r-[2.5px] border-r-slate-700' : 'border-r-[2px] border-r-slate-400'
                } ${
                  hasData
                    ? stat.bokgyeok > 0
                      ? 'text-purple-700 font-black bg-purple-50/20'
                      : 'text-slate-300 bg-white'
                    : 'text-slate-300 bg-slate-50/40'
                } ${borderBottom}`}
              >
                {hasData && stat.bokgyeok > 0 ? stat.bokgyeok : '-'}
              </td>
            </React.Fragment>
          );
        })}
      </tr>
    );
  };

  const renderPublicRow = (
    drv: DriverYearlyStat,
    idx: number,
    list: DriverYearlyStat[],
    isPartialSection: boolean
  ) => {
    const isLastInSection = idx === list.length - 1;
    const borderBottom = isLastInSection
      ? 'border-b-[2.5px] border-b-slate-700'
      : 'border-b border-b-slate-200';
    const isSp = drv.busNo.toUpperCase() === 'SP';
    const stickyBg = isPartialSection
      ? 'bg-amber-50 group-hover:bg-amber-100'
      : 'bg-white group-hover:bg-slate-50';

    return (
      <tr key={drv.name} className={`h-[26px] transition-colors group`}>
        <td
          className={`sticky left-0 z-30 w-[38px] min-w-[38px] py-0 px-0 text-center font-black text-[12.5px] tracking-tighter border-l-[2.5px] border-l-slate-700 border-r border-r-slate-300 ${
            isSp ? 'text-indigo-700 bg-indigo-50' : 'text-slate-800 bg-slate-50'
          } ${borderBottom}`}
        >
          {drv.busNo}
        </td>
        <td
          className={`sticky left-[38px] z-30 w-[52px] min-w-[52px] py-0 px-0 text-center font-extrabold text-[12.5px] text-slate-900 tracking-tighter whitespace-nowrap border-r-[2px] border-r-slate-500 ${stickyBg} ${borderBottom}`}
        >
          {drv.name}
        </td>

        <td
          className={`sticky left-[90px] z-30 w-[30px] min-w-[30px] py-0 px-0 text-center font-black text-[12.5px] tracking-tighter ${
            drv.totals.workDays > 0 ? 'text-slate-900' : 'text-slate-300'
          } bg-emerald-50 border-r border-r-emerald-200 ${borderBottom}`}
        >
          {drv.totals.workDays > 0 ? drv.totals.workDays : '-'}
        </td>
        <td
          className={`sticky left-[120px] z-30 w-[30px] min-w-[30px] py-0 px-0 text-center font-black text-[12.5px] tracking-tighter ${
            drv.totals.sojeong > 0 ? 'text-emerald-900' : 'text-slate-300'
          } bg-emerald-50 border-r border-r-emerald-200 ${borderBottom}`}
        >
          {drv.totals.sojeong > 0 ? drv.totals.sojeong : '-'}
        </td>
        <td
          className={`sticky left-[150px] z-30 w-[24px] min-w-[24px] py-0 px-0 text-center font-black text-[12.5px] tracking-tighter ${
            drv.totals.jeolnal > 0 ? 'text-rose-600' : 'text-slate-300'
          } bg-emerald-50 border-r border-r-emerald-200 ${borderBottom}`}
        >
          {drv.totals.jeolnal > 0 ? drv.totals.jeolnal : '-'}
        </td>
        <td
          className={`sticky left-[174px] z-30 w-[26px] min-w-[26px] py-0 px-0 text-center font-black text-[12.5px] tracking-tighter ${
            drv.totals.overtime > 0 ? 'text-orange-600' : 'text-slate-300'
          } bg-emerald-50 border-r border-r-emerald-200 ${borderBottom}`}
        >
          {drv.totals.overtime > 0 ? drv.totals.overtime : '-'}
        </td>
        <td
          className={`sticky left-[200px] z-30 w-[32px] min-w-[32px] py-0 px-0 text-center font-black text-[12.5px] tracking-tighter ${
            drv.totals.extraTotal > 0 ? 'text-red-700' : 'text-slate-300'
          } bg-red-50 border-r border-r-emerald-200 ${borderBottom}`}
        >
          {drv.totals.extraTotal > 0 ? drv.totals.extraTotal : '-'}
        </td>
        <td
          className={`sticky left-[232px] z-30 w-[32px] min-w-[32px] py-0 px-0 text-center font-black text-[12.5px] tracking-tighter ${
            drv.totals.longShift > 0 ? 'text-amber-900' : 'text-slate-300'
          } bg-amber-100 border-r-[2.5px] border-r-slate-700 ${borderBottom}`}
        >
          {drv.totals.longShift > 0 ? drv.totals.longShift : '-'}
        </td>

        {monthsArray.map(m => {
          const stat = drv.monthly[m];
          const hasData = !!stat?.hasWorked;
          const isDeficient = hasData && stat.workDays < stat.sojeong;
          const isLastM = m === 12;

          return (
            <React.Fragment key={m}>
              <td
                className={`w-[26px] min-w-[26px] py-0 px-0 text-center font-bold text-[12px] tracking-tighter border-r border-r-slate-200 ${
                  hasData && stat.workDays > 0
                    ? isDeficient
                      ? 'text-red-600 font-black bg-red-50/40'
                      : 'text-slate-900 bg-white'
                    : 'text-slate-300 bg-slate-50/40'
                } ${borderBottom}`}
              >
                {hasData && stat.workDays > 0 ? stat.workDays : '-'}
              </td>
              <td
                className={`w-[26px] min-w-[26px] py-0 px-0 text-center font-bold text-[12px] tracking-tighter border-r border-r-slate-200 ${
                  hasData && stat.sojeong > 0
                    ? 'text-emerald-800 bg-emerald-50/20'
                    : 'text-slate-300 bg-slate-50/40'
                } ${borderBottom}`}
              >
                {hasData && stat.sojeong > 0 ? stat.sojeong : '-'}
              </td>
              <td
                className={`w-[22px] min-w-[22px] py-0 px-0 text-center font-bold text-[12px] tracking-tighter border-r border-r-slate-200 ${
                  hasData
                    ? stat.jeolnal > 0
                      ? 'text-rose-600 font-black bg-rose-50/20'
                      : 'text-slate-300 bg-white'
                    : 'text-slate-300 bg-slate-50/40'
                } ${borderBottom}`}
              >
                {hasData && stat.jeolnal > 0 ? stat.jeolnal : '-'}
              </td>
              <td
                className={`w-[24px] min-w-[24px] py-0 px-0 text-center font-bold text-[12px] tracking-tighter border-r border-r-slate-200 ${
                  hasData
                    ? stat.overtime > 0
                      ? 'text-orange-600 font-black bg-orange-50/20'
                      : 'text-slate-300 bg-white'
                    : 'text-slate-300 bg-slate-50/40'
                } ${borderBottom}`}
              >
                {hasData && stat.overtime > 0 ? stat.overtime : '-'}
              </td>
              <td
                className={`w-[30px] min-w-[30px] py-0 px-0 text-center font-bold text-[12px] tracking-tighter border-r border-r-slate-200 ${
                  hasData && stat.extraTotal > 0
                    ? 'text-red-700 font-black bg-red-50/30'
                    : 'text-slate-300 bg-slate-50/40'
                } ${borderBottom}`}
              >
                {hasData && stat.extraTotal > 0 ? stat.extraTotal : '-'}
              </td>
              <td
                className={`w-[30px] min-w-[30px] py-0 px-0 text-center font-bold text-[12px] tracking-tighter ${
                  isLastM ? 'border-r-[2.5px] border-r-slate-700' : 'border-r-[2px] border-r-slate-400'
                } ${
                  hasData && stat.longShift > 0
                    ? 'text-amber-800 font-black bg-amber-50/30'
                    : 'text-slate-300 bg-slate-50/40'
                } ${borderBottom}`}
              >
                {hasData && stat.longShift > 0 ? stat.longShift : '-'}
              </td>
            </React.Fragment>
          );
        })}
      </tr>
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col w-full h-full bg-slate-50 font-sans overscroll-none relative"
    >
      {/* ✨ 상단 제목행: zoom: scale 동시 적용 + 제목 글자 겹침 방지(shrink-0 whitespace-nowrap) */}
      <header
        style={{ zoom: scale } as React.CSSProperties}
        className="flex flex-nowrap items-center justify-between gap-2 px-2.5 sm:px-4 py-1.5 xl:py-2 bg-white border-b border-gray-200 shadow-sm shrink-0 relative z-50 overflow-x-auto"
      >
        <div className="flex items-center gap-1.5 xl:gap-3 shrink-0">
          <div className="flex items-center bg-white border-[2px] border-slate-200 hover:border-blue-300 rounded-xl shadow-sm p-0.5 transition-colors">
            <button
              onClick={() => setYear(y => y - 1)}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all active:scale-95"
            >
              <ChevronLeft size={16} strokeWidth={3} className="xl:w-[18px] xl:h-[18px]" />
            </button>
            <div className="px-2 xl:px-3 flex items-center gap-1.5 font-black text-[13.5px] xl:text-[16px] text-slate-800 tracking-tighter select-none whitespace-nowrap">
              <CalendarDays size={15} strokeWidth={2.5} className="text-blue-500 xl:w-[18px] xl:h-[18px]" />
              {year}년
            </div>
            <button
              onClick={() => setYear(y => y + 1)}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all active:scale-95"
            >
              <ChevronRight size={16} strokeWidth={3} className="xl:w-[18px] xl:h-[18px]" />
            </button>
          </div>

          {year !== currentYear && (
            <button
              onClick={() => setYear(currentYear)}
              className="h-[30px] xl:h-[36px] px-2.5 xl:px-3 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white font-black rounded-lg xl:rounded-xl shadow-sm transition-all active:scale-95 text-[12px] xl:text-[13px] whitespace-nowrap"
            >
              올해
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 xl:gap-2 shrink-0 px-2 whitespace-nowrap">
          <BarChartBig className="text-blue-600 shrink-0 xl:w-[22px] xl:h-[22px]" size={18} strokeWidth={2.5} />
          <h1 className="font-black text-[14.5px] sm:text-[16px] xl:text-[19px] leading-none text-gray-800 tracking-tight whitespace-nowrap shrink-0">
            {route && route !== '미지정' && (
              <span className="mr-1.5">
                <span className="text-indigo-700">{route}</span>노선
              </span>
            )}
            {year}년 근무 통계
          </h1>
        </div>

        <div className="flex items-center gap-1.5 xl:gap-2 shrink-0">
          {activeMonths.length > 0 && (
            <span className="px-2 xl:px-2.5 py-1 xl:py-1.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg xl:rounded-xl font-extrabold text-[11px] xl:text-[12.5px] whitespace-nowrap">
              집계월: {activeMonths[0]}월~{activeMonths[activeMonths.length - 1]}월 (총 {totalDriverCount}명)
            </span>
          )}
          <button
            onClick={handleExportExcel}
            className="h-[30px] xl:h-[36px] px-2.5 xl:px-3 flex items-center justify-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-extrabold rounded-lg xl:rounded-xl shadow-sm transition-all active:scale-95 text-[11.5px] xl:text-[13px] whitespace-nowrap shrink-0"
          >
            <Download size={13} strokeWidth={2.5} className="text-emerald-600 xl:w-[15px] xl:h-[15px]" /> 엑셀저장
          </button>
        </div>
      </header>

      <div className="flex-1 bg-slate-100 p-0 sm:p-1.5 flex flex-col min-h-0 relative">
        {scale !== 1 && (
          <button
            type="button"
            onClick={resetScale}
            className="fixed bottom-[48px] right-4 z-[180] px-3 py-1.5 bg-slate-900/90 text-white font-black text-[12px] rounded-full shadow-lg border border-slate-700 active:scale-95"
          >
            🔍 {Math.round(scale * 100)}% (터치 시 100%)
          </button>
        )}

        <div className="flex-1 overflow-auto relative touch-pan-x touch-pan-y touch-pinch-zoom shadow-sm">
          <table
            style={{ zoom: scale } as React.CSSProperties}
            className="w-max min-w-full border-separate border-spacing-0 text-sm table-fixed bg-white"
          >
            <thead className="sticky top-0 z-40 bg-slate-100">
              {isPrivate ? (
                <>
                  <tr className="h-[26px]">
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-50 w-[24px] min-w-[24px] py-0 px-0 bg-sky-100 text-slate-800 font-black text-[11.5px] border-l-[2.5px] border-l-slate-700 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-600 border-r border-r-slate-400 align-middle"
                    >
                      팀
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort({ type: 'DEFAULT' })}
                      className="sticky left-[24px] z-50 w-[38px] min-w-[38px] py-0 px-0 bg-sky-100 text-slate-800 font-black text-[11.5px] border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-600 border-r border-r-slate-400 cursor-pointer hover:bg-sky-200 transition-colors select-none align-middle"
                      title="클릭 시 기본 정렬로 복원"
                    >
                      <div className="flex flex-col items-center justify-center w-full h-full gap-0.5">
                        <span className="leading-none tracking-tighter">차번</span>
                        <span className="inline-flex items-center justify-center px-1 py-0.5 rounded bg-blue-600 text-white">
                          <RotateCcw size={10} strokeWidth={3} />
                        </span>
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      className="sticky left-[62px] z-50 w-[52px] min-w-[52px] py-0 px-0 bg-sky-100 text-slate-800 font-black text-[12.5px] border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-600 border-r-[2px] border-r-slate-500 align-middle"
                    >
                      성명
                    </th>
                    <th
                      colSpan={4}
                      className="sticky left-[114px] z-50 py-0.5 px-0 bg-emerald-100 text-emerald-950 font-black text-[12.5px] border-t-[2.5px] border-t-slate-700 border-b border-b-emerald-300 border-r-[2.5px] border-r-slate-700 text-center align-middle"
                    >
                      합계
                    </th>
                    {monthsArray.map(m => (
                      <th
                        key={m}
                        colSpan={3}
                        className={`py-0.5 px-0 bg-slate-200 text-slate-800 font-black text-[12.5px] border-t-[2.5px] border-t-slate-700 border-b border-b-slate-300 ${
                          m === 12 ? 'border-r-[2.5px] border-r-slate-700' : 'border-r-[2px] border-r-slate-400'
                        } text-center align-middle`}
                      >
                        {m}월
                      </th>
                    ))}
                  </tr>
                  <tr className="h-[22px]">
                    <th
                      onClick={() => handleSort({ type: 'TOTAL', field: 'workDays' })}
                      className="sticky left-[114px] z-50 w-[30px] min-w-[30px] py-0 px-0 bg-emerald-100 text-emerald-950 font-extrabold text-[11px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-emerald-200 cursor-pointer hover:bg-emerald-200 transition-colors select-none align-middle text-center"
                    >
                      근무
                    </th>
                    <th
                      onClick={() => handleSort({ type: 'TOTAL', field: 'jeolnal' })}
                      className="sticky left-[144px] z-50 w-[24px] min-w-[24px] py-0 px-0 bg-emerald-100 text-rose-700 font-extrabold text-[11px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-emerald-200 cursor-pointer hover:bg-emerald-200 transition-colors select-none align-middle text-center"
                    >
                      절
                    </th>
                    <th
                      onClick={() => handleSort({ type: 'TOTAL', field: 'bokgyeok' })}
                      className="sticky left-[168px] z-50 w-[28px] min-w-[28px] py-0 px-0 bg-emerald-100 text-purple-800 font-extrabold text-[11px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-emerald-200 cursor-pointer hover:bg-emerald-200 transition-colors select-none align-middle text-center"
                    >
                      복격
                    </th>
                    <th
                      onClick={() => handleSort({ type: 'TOTAL', field: 'support' })}
                      className="sticky left-[196px] z-50 w-[28px] min-w-[28px] py-0 px-0 bg-emerald-200 text-emerald-950 font-extrabold text-[11px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r-[2.5px] border-r-slate-700 cursor-pointer hover:bg-emerald-300 transition-colors select-none align-middle text-center"
                    >
                      지원
                    </th>
                    {monthsArray.map(m => (
                      <React.Fragment key={m}>
                        <th
                          onClick={() => handleSort({ type: 'MONTH', month: m, field: 'workDays' })}
                          className="w-[28px] min-w-[28px] py-0 px-0 bg-slate-50 text-slate-700 font-extrabold text-[11px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-slate-200 cursor-pointer hover:bg-slate-200 transition-colors select-none align-middle text-center"
                        >
                          근무
                        </th>
                        <th
                          onClick={() => handleSort({ type: 'MONTH', month: m, field: 'jeolnal' })}
                          className="w-[24px] min-w-[24px] py-0 px-0 bg-rose-50 text-rose-700 font-extrabold text-[11px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-slate-200 cursor-pointer hover:bg-rose-100 transition-colors select-none align-middle text-center"
                        >
                          절
                        </th>
                        <th
                          onClick={() => handleSort({ type: 'MONTH', month: m, field: 'bokgyeok' })}
                          className={`w-[28px] min-w-[28px] py-0 px-0 bg-purple-50 text-purple-800 font-extrabold text-[11px] tracking-tighter border-b-[2.5px] border-b-slate-600 ${
                            m === 12 ? 'border-r-[2.5px] border-r-slate-700' : 'border-r-[2px] border-r-slate-400'
                          } cursor-pointer hover:bg-purple-100 transition-colors select-none align-middle text-center`}
                        >
                          복격
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </>
              ) : (
                <>
                  <tr className="h-[26px]">
                    <th
                      rowSpan={2}
                      onClick={() => handleSort({ type: 'DEFAULT' })}
                      className="sticky left-0 z-50 w-[38px] min-w-[38px] py-0 px-0 bg-slate-200 text-slate-800 font-black text-[11.5px] border-l-[2.5px] border-l-slate-700 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-600 border-r border-r-slate-400 cursor-pointer hover:bg-slate-300 transition-colors select-none align-middle"
                      title="클릭 시 기본 정렬로 복원"
                    >
                      <div className="flex flex-col items-center justify-center w-full h-full gap-0.5">
                        <span className="leading-none tracking-tighter">차번</span>
                        <span className="inline-flex items-center justify-center px-1 py-0.5 rounded bg-blue-600 text-white">
                          <RotateCcw size={10} strokeWidth={3} />
                        </span>
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      className="sticky left-[38px] z-50 w-[52px] min-w-[52px] py-0 px-0 bg-slate-200 text-slate-800 font-black text-[12.5px] border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-600 border-r-[2px] border-r-slate-500 align-middle"
                    >
                      성명
                    </th>
                    <th
                      colSpan={6}
                      className="sticky left-[90px] z-50 py-0.5 px-0 bg-emerald-100 text-emerald-950 font-black text-[12.5px] border-t-[2.5px] border-t-slate-700 border-b border-b-emerald-300 border-r-[2.5px] border-r-slate-700 text-center align-middle"
                    >
                      합계
                    </th>
                    {monthsArray.map(m => (
                      <th
                        key={m}
                        colSpan={6}
                        className={`py-0.5 px-0 bg-slate-200 text-slate-800 font-black text-[12.5px] border-t-[2.5px] border-t-slate-700 border-b border-b-slate-300 ${
                          m === 12 ? 'border-r-[2.5px] border-r-slate-700' : 'border-r-[2px] border-r-slate-400'
                        } text-center align-middle`}
                      >
                        {m}월
                      </th>
                    ))}
                  </tr>
                  <tr className="h-[22px]">
                    <th
                      onClick={() => handleSort({ type: 'TOTAL', field: 'workDays' })}
                      className="sticky left-[90px] z-50 w-[30px] min-w-[30px] py-0 px-0 bg-emerald-100 text-slate-900 font-extrabold text-[10.5px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-emerald-200 cursor-pointer hover:bg-emerald-200 transition-colors select-none align-middle text-center"
                    >
                      근무
                    </th>
                    <th
                      onClick={() => handleSort({ type: 'TOTAL', field: 'sojeong' })}
                      className="sticky left-[120px] z-50 w-[30px] min-w-[30px] py-0 px-0 bg-emerald-100 text-emerald-950 font-extrabold text-[10.5px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-emerald-200 cursor-pointer hover:bg-emerald-200 transition-colors select-none align-middle text-center"
                    >
                      소정
                    </th>
                    <th
                      onClick={() => handleSort({ type: 'TOTAL', field: 'jeolnal' })}
                      className="sticky left-[150px] z-50 w-[24px] min-w-[24px] py-0 px-0 bg-emerald-100 text-rose-700 font-extrabold text-[10.5px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-emerald-200 cursor-pointer hover:bg-emerald-200 transition-colors select-none align-middle text-center"
                    >
                      절
                    </th>
                    <th
                      onClick={() => handleSort({ type: 'TOTAL', field: 'overtime' })}
                      className="sticky left-[174px] z-50 w-[26px] min-w-[26px] py-0 px-0 bg-emerald-100 text-orange-700 font-extrabold text-[10.5px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-emerald-200 cursor-pointer hover:bg-emerald-200 transition-colors select-none align-middle text-center"
                    >
                      연장
                    </th>
                    <th
                      onClick={() => handleSort({ type: 'TOTAL', field: 'extraTotal' })}
                      className="sticky left-[200px] z-50 w-[32px] min-w-[32px] py-0 px-0 bg-red-100 text-red-800 font-extrabold text-[10px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-emerald-200 cursor-pointer hover:bg-red-200 transition-colors select-none align-middle text-center"
                    >
                      추가합
                    </th>
                    <th
                      onClick={() => handleSort({ type: 'TOTAL', field: 'longShift' })}
                      className="sticky left-[232px] z-50 w-[32px] min-w-[32px] py-0 px-0 bg-amber-200 text-amber-950 font-extrabold text-[10px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r-[2.5px] border-r-slate-700 cursor-pointer hover:bg-amber-300 transition-colors select-none align-middle text-center"
                    >
                      긴근무
                    </th>
                    {monthsArray.map(m => (
                      <React.Fragment key={m}>
                        <th
                          onClick={() => handleSort({ type: 'MONTH', month: m, field: 'workDays' })}
                          className="w-[26px] min-w-[26px] py-0 px-0 bg-slate-50 text-slate-700 font-extrabold text-[10.5px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-slate-200 cursor-pointer hover:bg-slate-200 transition-colors select-none align-middle text-center"
                        >
                          근무
                        </th>
                        <th
                          onClick={() => handleSort({ type: 'MONTH', month: m, field: 'sojeong' })}
                          className="w-[26px] min-w-[26px] py-0 px-0 bg-emerald-50 text-emerald-900 font-extrabold text-[10.5px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-slate-200 cursor-pointer hover:bg-emerald-100 transition-colors select-none align-middle text-center"
                        >
                          소정
                        </th>
                        <th
                          onClick={() => handleSort({ type: 'MONTH', month: m, field: 'jeolnal' })}
                          className="w-[22px] min-w-[22px] py-0 px-0 text-center bg-rose-50 text-rose-700 font-extrabold text-[10.5px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-slate-200 cursor-pointer hover:bg-rose-100 transition-colors select-none align-middle"
                        >
                          절
                        </th>
                        <th
                          onClick={() => handleSort({ type: 'MONTH', month: m, field: 'overtime' })}
                          className="w-[24px] min-w-[24px] py-0 px-0 bg-orange-50 text-orange-700 font-extrabold text-[10.5px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-slate-200 cursor-pointer hover:bg-orange-100 transition-colors select-none align-middle text-center"
                        >
                          연장
                        </th>
                        <th
                          onClick={() => handleSort({ type: 'MONTH', month: m, field: 'extraTotal' })}
                          className="w-[30px] min-w-[30px] py-0 px-0 bg-red-50 text-red-700 font-extrabold text-[10px] tracking-tighter border-b-[2.5px] border-b-slate-600 border-r border-r-slate-200 cursor-pointer hover:bg-red-100 transition-colors select-none align-middle text-center"
                        >
                          추가합
                        </th>
                        <th
                          onClick={() => handleSort({ type: 'MONTH', month: m, field: 'longShift' })}
                          className={`w-[30px] min-w-[30px] py-0 px-0 bg-amber-50 text-amber-900 font-extrabold text-[10px] tracking-tighter border-b-[2.5px] border-b-slate-600 ${
                            m === 12 ? 'border-r-[2.5px] border-r-slate-700' : 'border-r-[2px] border-r-slate-400'
                          } cursor-pointer hover:bg-amber-100 transition-colors select-none align-middle text-center`}
                        >
                          긴근무
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </>
              )}
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={totalColSpan}
                    className="text-center py-12 text-slate-500 font-bold text-[14.5px] border-b-[2.5px] border-b-slate-700 border-x-[2.5px] border-x-slate-700"
                  >
                    연간 통계 데이터를 계산하는 중입니다...
                  </td>
                </tr>
              ) : totalDriverCount === 0 ? (
                <tr>
                  <td
                    colSpan={totalColSpan}
                    className="text-center py-12 text-slate-400 font-bold text-[14.5px] border-b-[2.5px] border-b-slate-700 border-x-[2.5px] border-x-slate-700"
                  >
                    {year}년에 등록된 배차 근무 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                <>
                  {fullYearDrivers.map((drv, idx) =>
                    isPrivate
                      ? renderPrivateRow(drv, idx, fullYearDrivers, false)
                      : renderPublicRow(drv, idx, fullYearDrivers, false)
                  )}

                  {partialYearDrivers.length > 0 && (
                    <>
                      <tr className="bg-slate-200 h-[22px]">
                        <td
                          colSpan={stickyColCount}
                          className="sticky left-0 z-30 bg-slate-200 px-2 py-0 text-left font-black text-[11.5px] text-slate-700 border-l-[2.5px] border-l-slate-700 border-r-[2.5px] border-r-slate-700 border-b-[2px] border-b-slate-500"
                        >
                          ▼ 일부 월 근무 ({partialYearDrivers.length}명) · 중도 합류/이동/퇴사
                        </td>
                        <td
                          colSpan={totalColSpan - stickyColCount}
                          className="px-3 py-0 text-left font-bold text-[11.5px] text-slate-600 bg-slate-200 border-r-[2.5px] border-r-slate-700 border-b-[2px] border-b-slate-500"
                        />
                      </tr>
                      {partialYearDrivers.map((drv, idx) =>
                        isPrivate
                          ? renderPrivateRow(drv, idx, partialYearDrivers, true)
                          : renderPublicRow(drv, idx, partialYearDrivers, true)
                      )}
                    </>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}