// 파일 위치: components/RosterView.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Bus,
  CalendarDays,
  Plus,
  RotateCcw,
  LayoutList,
  Download,
  Undo2,
  Redo2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Search,
  X,
  Wand2,
} from 'lucide-react';
import { useRosterData } from '../hooks/useRosterData';
import { useMobileViewport } from '../hooks/useMobileViewport';
import {
  calculateRowStats,
  DEFAULT_PLACEHOLDER_NAMES,
  getDayType,
  isNormalPrivateShift,
  type DriverInfo,
  type RowStatsResult,
} from '../utils/calculator';

import RosterTableRow from './RosterTableRow';
import DailySummary from './DailySummary';
import MonthPickerModal from './modals/MonthPickerModal';
import AddDriverModal from './modals/AddDriverModal';
import ScheduleInputModal, { type ShiftHolderInfo } from './modals/ScheduleInputModal';
import SubstituteListModal, { type SubstituteCandidate } from './modals/SubstituteListModal';
import ResetConfirmModal from './modals/ResetConfirmModal';
import DriverShareModal from './modals/DriverShareModal';
import InitialSetupModal from './modals/InitialSetupModal';
import DailyShiftCheckModal from './modals/DailyShiftCheckModal';

function isActualPublicWork(work: string | undefined): boolean {
  if (!work) return false;
  const w = work.trim();
  if (!w) return false;
  if (['신청휴무', '휴무', 'x', 'X', '-', '연차', '연'].includes(w)) return false;
  return true;
}

const DOW_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

interface ToastData {
  message: string;
  subMessage?: string;
  type: 'SUCCESS' | 'WARNING';
}

export default function RosterView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showLongShifts, setShowLongShifts] = useState(false);

  const [highlightFilter, setHighlightFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toast, setToast] = useState<ToastData | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const showToast = useCallback(
    (message: string, type: 'SUCCESS' | 'WARNING' = 'SUCCESS', subMessage?: string) => {
      setToast({ message, type, subMessage });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const duration = toast.type === 'WARNING' ? 4200 : 2500;
    const timer = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(timer);
  }, [toast]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDaysCount = useMemo(() => new Date(year, month - 1, 0).getDate(), [year, month]);
  const daysArray = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const todayDay = useMemo(() => {
    const now = new Date();
    if (now.getFullYear() === year && now.getMonth() + 1 === month) {
      return now.getDate();
    }
    return null;
  }, [year, month]);

  const {
    rosterData,
    processedRoster,
    maxDriverOrder,
    dailyStats,
    isRosterLoading,
    route,
    hourlyWage,
    routeInfo,
    allRoutes,
    prevMonthRoster,
    nextMonthRoster,
    saveStatus,
    canUndo,
    canRedo,
    undo,
    redo,
    addBusGroup,
    moveRowUp,
    moveRowDown,
    deleteRow,
    updateDriverName,
    clearDriverSchedules,
    updateDriverDefaultRestDays,
    autoExtractAllDefaultRestDays,
    updateBusNo,
    applySchedule,
    runPublicInitialSetup,
    runPrivateInitialSetup,
    assignSubstitute,
    swapSchedule,
    resetAllSchedules,
    clearAllData,
  } = useRosterData(year, month, daysArray);

  const {
    containerRef,
    scale,
    resetScale,
    showLandscapePrompt,
    forceEnterLandscape,
    dismissLandscapePrompt,
  } = useMobileViewport();

  // PC 화면 컨테이너 가로 폭을 실시간 감지하여 추가표시 ON/OFF와 무관하게 기본 열 너비를 고정 유지
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      setContainerWidth(el.clientWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [containerRef]);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isSubstituteModalOpen, setIsSubstituteModalOpen] = useState(false);
  const [isInitialSetupModalOpen, setIsInitialSetupModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ bIdx: number; dIdx: number } | null>(null);
  const [dailyCheckTarget, setDailyCheckTarget] = useState<{
    day: number;
    focusType: 'AM' | 'PM' | 'TOTAL';
  } | null>(null);

  const [activeMenuIndex, setActiveMenuIndex] = useState<{ bIdx: number; dIdx: number } | null>(null);
  const [editingDriver, setEditingDriver] = useState<{ bIdx: number; dIdx: number } | null>(null);
  const [editingBusIndex, setEditingBusIndex] = useState<number | null>(null);

  const [scheduleModalObj, setScheduleModalObj] = useState<{
    bIdx: number;
    dIdx: number;
    day: number;
    dayType: string;
  } | null>(null);

  const isModalActive = !!scheduleModalObj;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          if (redo()) showToast('작업을 다시 실행했습니다.');
        } else {
          e.preventDefault();
          if (undo()) showToast('이전 배차 상태로 되돌렸습니다.');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (redo()) showToast('작업을 다시 실행했습니다.');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, showToast]);

  useEffect(() => {
    if (!scheduleModalObj) {
      setIsSubstituteModalOpen(false);
    }
  }, [scheduleModalObj]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.row-menu') && !target.closest('.name-edit-popover')) {
        setActiveMenuIndex(null);
        setEditingDriver(null);
        setEditingBusIndex(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const cacheKey = `cached_holidays_${year}`;
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
      try {
        setHolidays(JSON.parse(cachedData));
        setIsLoading(false);
        return;
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    const fetchHolidays = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/holidays?year=${year}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && !data.error) {
          setHolidays(data);
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        }
      } catch (err) {
        console.error('공휴일 불러오기 실패', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHolidays();
  }, [year]);

  const getDayOfWeekText = useCallback(
    (day: number) => {
      return DOW_NAMES[new Date(year, month - 1, day).getDay()];
    },
    [year, month]
  );

  const handleRowDelete = useCallback(
    (index: number) => {
      if (window.confirm('정말 이 차량과 소속 기사 데이터를 모두 삭제하시겠습니까?')) {
        deleteRow(index);
        setActiveMenuIndex(null);
        showToast('차량 행이 삭제되었습니다. (실행 취소 가능)');
      }
    },
    [deleteRow, showToast]
  );

  const handleDriverEditConfirmUI = useCallback(
    (bIdx: number, dIdx: number, newName: string) => {
      updateDriverName(bIdx, dIdx, newName.trim());
      setEditingDriver(null);
    },
    [updateDriverName]
  );

  const handleClearDriverSchedulesUI = useCallback(
    (bIdx: number, dIdx: number) => {
      clearDriverSchedules(bIdx, dIdx);
      showToast('해당 기사님의 이번 달 근무가 모두 삭제되었습니다.');
    },
    [clearDriverSchedules, showToast]
  );

  const handleDefaultRestSaveUI = useCallback(
    (bIdx: number, dIdx: number, restDays: string[], syncPartner: boolean) => {
      updateDriverDefaultRestDays(bIdx, dIdx, restDays, syncPartner);
      showToast(
        syncPartner
          ? `기본휴무(${restDays.join('')})가 파트너 기사와 함께 저장되었습니다.`
          : `기본휴무(${restDays.join('')})가 저장되었습니다.`
      );
    },
    [updateDriverDefaultRestDays, showToast]
  );

  const handleAutoExtractRestDaysUI = useCallback(() => {
    const count = autoExtractAllDefaultRestDays();
    if (count > 0) {
      showToast(
        `미지정 기사 ${count}명의 기본휴무가 자동 설정되었습니다!`,
        'SUCCESS',
        '이미 지정된 기사의 기본휴무는 변경되지 않고 그대로 유지됩니다.'
      );
    } else {
      showToast(
        '새로 설정할 미지정 기사가 없습니다.',
        'SUCCESS',
        '이미 지정된 기본휴무는 고정휴무와 다르더라도 안전하게 유지됩니다.'
      );
    }
  }, [autoExtractAllDefaultRestDays, showToast]);

  const handleOpenShareModal = useCallback((bIdx: number, dIdx: number) => {
    setShareTarget({ bIdx, dIdx });
  }, []);

  const handleBusEditConfirmUI = useCallback(
    (bIdx: number, newBusNo: string): boolean => {
      const result = updateBusNo(bIdx, newBusNo);
      if (!result.success) {
        if (result.empty) {
          showToast('차량 번호를 입력해 주세요.', 'WARNING');
        } else if (result.duplicate) {
          showToast(
            `입력하신 '${newBusNo.trim()}' 차번은 이미 등록되어 있습니다.`,
            'WARNING',
            '다른 차량 번호를 입력해 주세요.'
          );
        }
        return false;
      }
      setEditingBusIndex(null);
      setActiveMenuIndex(null);
      return true;
    },
    [updateBusNo, showToast]
  );

  const handleScheduleApplyUI = useCallback(
    (workText: string | null, isCustom: boolean = false) => {
      if (!scheduleModalObj) return;
      applySchedule(
        scheduleModalObj.bIdx,
        scheduleModalObj.dIdx,
        scheduleModalObj.day,
        workText,
        isCustom,
        scheduleModalObj.dayType
      );
      setScheduleModalObj(null);
    },
    [scheduleModalObj, applySchedule]
  );

  const handleSelectMonth = useCallback((m: number, y: number) => {
    setCurrentDate(new Date(y, m - 1, 1));
    setIsPickerOpen(false);
  }, []);

  const maxShiftCount = routeInfo?.weekdayCount || maxDriverOrder || 50;
  const isPrivate = routeInfo?.routeType === 'PRIVATE';

  const hasAnyScheduleData = useMemo(() => {
    return rosterData.some(group =>
      group.drivers.some(drv =>
        Object.values(drv.schedules || {}).some(val => val && val.trim() !== '')
      )
    );
  }, [rosterData]);

  const handleInitialSetupClick = () => {
    if (processedRoster.length === 0) {
      if (!prevMonthRoster || prevMonthRoster.length === 0) {
        showToast(
          '불러올 이전 달 배차 데이터가 없습니다.',
          'WARNING',
          '먼저 상단 [+ 추가] 버튼으로 차량과 기사를 등록해 주세요.'
        );
        return;
      }
      setIsInitialSetupModalOpen(true);
      return;
    }

    if (isPrivate) {
      setIsInitialSetupModalOpen(true);
      return;
    }

    const missingDrivers: string[] = [];
    processedRoster.forEach((group, bIdx) => {
      group.drivers.forEach((drv: DriverInfo, dIdx: number) => {
        const name = drv.name?.trim() || '';
        if (!name) return;

        if (drv.defaultRestDays && drv.defaultRestDays.length === 2) return;

        const isSp = group.busNo.trim().toUpperCase() === 'SP';
        if (!isSp && group.drivers.length === 2) {
          const partner = group.drivers[dIdx === 0 ? 1 : 0];
          if (partner?.defaultRestDays && partner.defaultRestDays.length === 2) return;
        }

        const hasCurrentSched = Object.values(drv.schedules || {}).some(
          w => w && !['x', 'X', '-', '휴무', '신청휴무'].includes(w.trim())
        );
        if (hasCurrentSched) return;

        const prevDrv =
          prevMonthRoster
            .flatMap(g => g.drivers)
            .find(d => d.name?.trim() === name) ||
          prevMonthRoster[bIdx]?.drivers?.[dIdx];
        if (prevDrv) {
          if (prevDrv.defaultRestDays && prevDrv.defaultRestDays.length === 2) return;
          const hasPrevSched = Object.values(prevDrv.schedules || {}).some(
            w => w && !['x', 'X', '-', '휴무', '신청휴무'].includes(w.trim())
          );
          if (hasPrevSched) return;
        }

        missingDrivers.push(`${group.busNo}(${name})`);
      });
    });

    if (missingDrivers.length > 0) {
      const targetStr = `${missingDrivers.slice(0, 6).join(', ')}${
        missingDrivers.length > 6 ? ` 외 ${missingDrivers.length - 6}명` : ''
      }`;
      showToast(
        '기본휴무가 지정되지 않은 기사가 있습니다.',
        'WARNING',
        `성명을 클릭해 기본휴무 요일 2개를 먼저 지정해 주세요. [미지정: ${targetStr}]`
      );
      return;
    }

    setIsInitialSetupModalOpen(true);
  };

  const handleConfirmInitialSetup = useCallback(() => {
    const wasEmpty = processedRoster.length === 0;
    const ok = isPrivate ? runPrivateInitialSetup() : runPublicInitialSetup();
    if (ok) {
      showToast(
        wasEmpty
          ? '이전 달 명단 호출 및 초기 기본 근무 세팅이 완료되었습니다!'
          : '초기 기본 근무가 자동으로 입력되었습니다!',
        'SUCCESS',
        isPrivate
          ? '이전 달 A/B조 순번 흐름에 이어 이번 달 기본 배차가 저장되었습니다.'
          : '이전 달 근무 패턴과 기본휴무를 기준으로 기본 배차가 저장되었습니다.'
      );
    }
  }, [processedRoster.length, isPrivate, runPrivateInitialSetup, runPublicInitialSetup, showToast]);

  const duplicateShifts = useMemo(() => {
    const duplicates: Record<number, string[]> = {};
    daysArray.forEach(day => {
      const shiftCounts: Record<string, number> = {};
      rosterData.forEach(group => {
        group.drivers.forEach(driver => {
          const work = (driver.schedules[String(day)] || '').trim();
          if (!work) return;
          if (isPrivate) {
            if (isNormalPrivateShift(work, allRoutes, maxShiftCount)) {
              shiftCounts[work] = (shiftCounts[work] || 0) + 1;
            }
          } else {
            if (/^(전|후)\d+$/.test(work)) {
              shiftCounts[work] = (shiftCounts[work] || 0) + 1;
            }
          }
        });
      });
      duplicates[day] = Object.keys(shiftCounts).filter(shift => shiftCounts[shift] > 1);
    });
    return duplicates;
  }, [rosterData, daysArray, allRoutes, maxShiftCount, isPrivate]);

  const { takenAm, takenPm, takenHolderMap } = useMemo(() => {
    const am: number[] = [];
    const pm: number[] = [];
    const holderMap: Record<string, ShiftHolderInfo> = {};
    if (!scheduleModalObj) return { takenAm: am, takenPm: pm, takenHolderMap: holderMap };

    const { day, bIdx: targetBIdx, dIdx: targetDIdx } = scheduleModalObj;
    const isPrivateRoute = routeInfo?.routeType === 'PRIVATE';

    rosterData.forEach((busGroup, bIdx) => {
      busGroup.drivers.forEach((driver, dIdx) => {
        if (bIdx === targetBIdx && dIdx === targetDIdx) return;

        const work = (driver.schedules[String(day)] || '').trim();
        if (work) {
          if (isPrivateRoute && isNormalPrivateShift(work, allRoutes, maxShiftCount)) {
            const num = parseInt(work, 10);
            if (!isNaN(num)) {
              am.push(num);
              holderMap[String(num)] = {
                bIdx,
                dIdx,
                name: driver.name.trim(),
                busNo: busGroup.busNo.trim(),
              };
            }
          } else if (work.includes('전')) {
            const num = parseInt(work.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num)) {
              am.push(num);
              holderMap[`전${num}`] = {
                bIdx,
                dIdx,
                name: driver.name.trim(),
                busNo: busGroup.busNo.trim(),
              };
            }
          } else if (work.includes('후')) {
            const num = parseInt(work.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num)) {
              pm.push(num);
              holderMap[`후${num}`] = {
                bIdx,
                dIdx,
                name: driver.name.trim(),
                busNo: busGroup.busNo.trim(),
              };
            }
          }
        }
      });
    });

    return { takenAm: am, takenPm: pm, takenHolderMap: holderMap };
  }, [scheduleModalObj, rosterData, routeInfo?.routeType, allRoutes, maxShiftCount]);

  const selectedCellInfo = useMemo(() => {
    if (!scheduleModalObj) {
      return { work: '', baseWork: '', hasBaseSchedule: false, driverName: '' };
    }
    const grp = rosterData[scheduleModalObj.bIdx];
    const drv = grp?.drivers?.[scheduleModalObj.dIdx];
    const baseSched = drv?.baseSchedules || {};
    return {
      work: drv?.schedules?.[String(scheduleModalObj.day)]?.trim() || '',
      baseWork: baseSched[String(scheduleModalObj.day)]?.trim() || '',
      hasBaseSchedule: Object.keys(baseSched).length > 0,
      driverName: drv?.name?.trim() || '',
    };
  }, [scheduleModalObj, rosterData]);

  const getExternalDayWork = useCallback(
    (
      extRoster: typeof prevMonthRoster,
      driverName: string,
      bIdx: number,
      dIdx: number,
      extDay: number
    ): string => {
      if (!extRoster || extRoster.length === 0) return '';
      if (driverName) {
        for (const g of extRoster) {
          for (const d of g.drivers) {
            if (d.name?.trim() === driverName) {
              return d.schedules?.[String(extDay)]?.trim() || '';
            }
          }
        }
      }
      return extRoster[bIdx]?.drivers?.[dIdx]?.schedules?.[String(extDay)]?.trim() || '';
    },
    []
  );

  const getDriverWorkAtDay = useCallback(
    (driver: DriverInfo, bIdx: number, dIdx: number, dOffset: number): string => {
      const name = driver.name.trim();
      if (dOffset >= 1 && dOffset <= daysInMonth) {
        return driver.schedules[String(dOffset)]?.trim() || '';
      } else if (dOffset < 1) {
        const prevDay = prevMonthDaysCount + dOffset;
        if (prevDay < 1) return '';
        return getExternalDayWork(prevMonthRoster, name, bIdx, dIdx, prevDay);
      } else {
        const nextDay = dOffset - daysInMonth;
        return getExternalDayWork(nextMonthRoster, name, bIdx, dIdx, nextDay);
      }
    },
    [daysInMonth, prevMonthDaysCount, prevMonthRoster, nextMonthRoster, getExternalDayWork]
  );

  const { publicWarningsByGroup, totalWarningCount } = useMemo(() => {
    const warningsGrid: Record<number, string[]>[][] = [];
    let warnCount = 0;

    if (isPrivate) {
      processedRoster.forEach((busGroup: any) => {
        const groupWarns: Record<number, string[]>[] = [];
        busGroup.drivers.forEach((driver: DriverInfo) => {
          const cellWarns: Record<number, string[]> = {};
          daysArray.forEach(day => {
            const work = (driver.schedules[String(day)] || '').trim();
            if (!work) return;
            const dayType = getDayType(year, month, day, holidays);
            if (isNormalPrivateShift(work, allRoutes, maxShiftCount)) {
              const num = Number(work);
              if (duplicateShifts[day]?.includes(work)) {
                cellWarns[day] = [...(cellWarns[day] || []), '중복 순번'];
              }
              if (
                (dayType === 'SAT' && routeInfo?.satDrops?.includes(num)) ||
                ((dayType === 'SUN' || dayType === 'JEOLNAL') && routeInfo?.sunDrops?.includes(num))
              ) {
                cellWarns[day] = [...(cellWarns[day] || []), '감차 순번'];
              }
            }
            if (cellWarns[day]?.length) warnCount++;
          });
          groupWarns.push(cellWarns);
        });
        warningsGrid.push(groupWarns);
      });
      return { publicWarningsByGroup: warningsGrid, totalWarningCount: warnCount };
    }

    processedRoster.forEach((busGroup: any, bIdx: number) => {
      const groupWarns: Record<number, string[]>[] = [];
      busGroup.drivers.forEach((driver: DriverInfo, dIdx: number) => {
        const cellWarns: Record<number, string[]> = {};

        const workedFlags: Record<number, boolean> = {};
        for (let offset = -5; offset <= daysInMonth + 6; offset++) {
          const w = getDriverWorkAtDay(driver, bIdx, dIdx, offset);
          workedFlags[offset] = isActualPublicWork(w);
        }

        daysArray.forEach(day => {
          const work = (driver.schedules[String(day)] || '').trim();
          if (!work || !isActualPublicWork(work)) return;

          const reasons: string[] = [];
          const dayType = getDayType(year, month, day, holidays);

          const prevW = getDriverWorkAtDay(driver, bIdx, dIdx, day - 1);
          const nextW = getDriverWorkAtDay(driver, bIdx, dIdx, day + 1);
          if (work.includes('전') && prevW.includes('후')) {
            reasons.push('역교대(전일 오후➔당일 오전)');
          } else if (work.includes('후') && nextW.includes('전')) {
            reasons.push('역교대(당일 오후➔익일 오전)');
          }

          let prevStreak = 0;
          for (let s = 1; s <= 6; s++) {
            if (workedFlags[day - s]) prevStreak++;
            else break;
          }
          let nextStreak = 0;
          for (let s = 1; s <= 6; s++) {
            if (workedFlags[day + s]) nextStreak++;
            else break;
          }
          const streakLen = prevStreak + 1 + nextStreak;
          if (streakLen >= 7) {
            reasons.push(`${streakLen}일 연속근무`);
          }

          if (duplicateShifts[day]?.includes(work)) {
            reasons.push(`순번 중복(${work})`);
          }

          const match = work.match(/^(전|후)(\d+)$/);
          if (match) {
            const num = parseInt(match[2], 10);
            if (dayType === 'SAT' && routeInfo?.satDrops?.includes(num)) {
              reasons.push(`토요일 감차 순번(${work})`);
            } else if (
              (dayType === 'SUN' || dayType === 'JEOLNAL') &&
              routeInfo?.sunDrops?.includes(num)
            ) {
              reasons.push(`휴일 감차 순번(${work})`);
            }
          }

          if (reasons.length > 0) {
            cellWarns[day] = reasons;
            warnCount++;
          }
        });

        groupWarns.push(cellWarns);
      });
      warningsGrid.push(groupWarns);
    });

    return { publicWarningsByGroup: warningsGrid, totalWarningCount: warnCount };
  }, [
    isPrivate,
    processedRoster,
    daysArray,
    daysInMonth,
    year,
    month,
    holidays,
    allRoutes,
    maxShiftCount,
    duplicateShifts,
    routeInfo,
    getDriverWorkAtDay,
  ]);

  const substituteCandidates = useMemo<SubstituteCandidate[]>(() => {
    if (!scheduleModalObj || routeInfo?.routeType === 'PRIVATE') return [];

    const { day, bIdx: targetBIdx, dIdx: targetDIdx } = scheduleModalObj;
    const targetWork = selectedCellInfo.work;
    if (!targetWork) return [];

    const isAmTarget = targetWork.includes('전');
    const isPmTarget = targetWork.includes('후');
    if (!isAmTarget && !isPmTarget) return [];

    const result: SubstituteCandidate[] = [];

    rosterData.forEach((busGroup, bIdx) => {
      busGroup.drivers.forEach((driver, dIdx) => {
        if (bIdx === targetBIdx && dIdx === targetDIdx) return;

        const name = driver.name?.trim() || '';
        if (!name) return;

        if (
          DEFAULT_PLACEHOLDER_NAMES.includes(name) &&
          Object.keys(driver.schedules || {}).length === 0
        ) {
          return;
        }

        const currentDayWork = driver.schedules[String(day)]?.trim() || '';
        if (
          isActualPublicWork(currentDayWork) ||
          currentDayWork === '연차' ||
          currentDayWork === '연'
        ) {
          return;
        }

        const prevWork = getDriverWorkAtDay(driver, bIdx, dIdx, day - 1);
        const nextWork = getDriverWorkAtDay(driver, bIdx, dIdx, day + 1);

        if (isAmTarget && prevWork.includes('후')) return;
        if (isPmTarget && nextWork.includes('전')) return;

        let prevConsecutive = 0;
        for (let step = 1; step <= 6; step++) {
          const w = getDriverWorkAtDay(driver, bIdx, dIdx, day - step);
          if (isActualPublicWork(w)) prevConsecutive++;
          else break;
        }

        let nextConsecutive = 0;
        for (let step = 1; step <= 6; step++) {
          const w = getDriverWorkAtDay(driver, bIdx, dIdx, day + step);
          if (isActualPublicWork(w)) nextConsecutive++;
          else break;
        }

        const totalConsecutive = prevConsecutive + 1 + nextConsecutive;
        if (totalConsecutive >= 7) return;

        result.push({
          bIdx,
          dIdx,
          name,
          busNo: busGroup.busNo.trim(),
          prevWork,
          nextWork,
          consecutiveDays: totalConsecutive,
        });
      });
    });

    return result;
  }, [scheduleModalObj, routeInfo?.routeType, selectedCellInfo.work, rosterData, getDriverWorkAtDay]);

  const handleAssignSubstituteUI = useCallback(
    (candidate: SubstituteCandidate, leaveType: '연차' | '신청휴무' | '') => {
      if (!scheduleModalObj) return;
      const ok = assignSubstitute(
        scheduleModalObj.day,
        scheduleModalObj.bIdx,
        scheduleModalObj.dIdx,
        candidate.bIdx,
        candidate.dIdx,
        leaveType
      );
      if (ok) {
        setIsSubstituteModalOpen(false);
        setScheduleModalObj(null);
        showToast(
          `${scheduleModalObj.day}일 [${selectedCellInfo.work}] 근무가 ${candidate.name} 기사님으로 대체되었습니다.`
        );
      }
    },
    [scheduleModalObj, assignSubstitute, selectedCellInfo.work, showToast]
  );

  const handleSwapScheduleUI = useCallback(
    (targetShift: string, holder: ShiftHolderInfo) => {
      if (!scheduleModalObj) return;
      const ok = swapSchedule(
        scheduleModalObj.day,
        scheduleModalObj.bIdx,
        scheduleModalObj.dIdx,
        holder.bIdx,
        holder.dIdx,
        targetShift
      );
      if (ok) {
        setScheduleModalObj(null);
        showToast(`${holder.name} 기사님과 [${targetShift}] 근무를 맞바꾸었습니다.`);
      }
    },
    [scheduleModalObj, swapSchedule, showToast]
  );

  const { rowStatsByGroup, maxSalary, minSalary } = useMemo(() => {
    const statsGrid: RowStatsResult[][] = [];
    const salaries: number[] = [];
    const currentRouteType = routeInfo?.routeType || 'PUBLIC';

    processedRoster.forEach((busGroup: any, bIdx: number) => {
      const groupStats: RowStatsResult[] = [];
      busGroup.drivers.forEach((driver: any, dIdx: number) => {
        const prevMonthLastDayWork = getExternalDayWork(
          prevMonthRoster,
          driver.name?.trim() || '',
          bIdx,
          dIdx,
          prevMonthDaysCount
        );

        const stats = calculateRowStats(
          driver,
          year,
          month,
          daysArray,
          holidays,
          hourlyWage,
          currentRouteType,
          prevMonthLastDayWork,
          allRoutes,
          maxShiftCount
        );
        groupStats.push(stats);
        if (stats.expectedSalary > 0) {
          salaries.push(stats.expectedSalary);
        }
      });
      statsGrid.push(groupStats);
    });

    return {
      rowStatsByGroup: statsGrid,
      maxSalary: salaries.length > 0 ? Math.max(...salaries) : 0,
      minSalary: salaries.length > 0 ? Math.min(...salaries) : 0,
    };
  }, [
    processedRoster,
    year,
    month,
    daysArray,
    holidays,
    hourlyWage,
    routeInfo?.routeType,
    prevMonthRoster,
    prevMonthDaysCount,
    allRoutes,
    maxShiftCount,
    getExternalDayWork,
  ]);

  const sortedLongShifts = useMemo(() => {
    const shifts = routeInfo?.longShifts || [];
    return [...shifts].sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
      if (numA === numB) return a.localeCompare(b);
      return numA - numB;
    });
  }, [routeInfo?.longShifts]);

  const headerRowSpan = showLongShifts && sortedLongShifts.length > 0 && !isPrivate ? 2 : 1;

  // PC 화면에서 추가표시 전(순서~예상급여)이 100% 꽉 차는 날짜 열 너비를 산출하고, 추가표시 클릭 시에도 그대로 고정 유지
  const isDesktop = containerWidth >= 1024;
  const leftStickyWidth = 30 + 44 + 62; // 순서(30) + 차번(44) + 성명(62) = 136px
  const rightStatsCols = isPrivate
    ? [40, 40, 40, 82] // 합계(40) + 절(40) + 복격(40) + 예상급여(82) = 202px
    : [34, 28, 28, 34, 36, 32, 32, 34, 78]; // 총근로~예상급여 = 336px
  const rightStatsWidth = rightStatsCols.reduce((a, b) => a + b, 0);

  const dayColWidth = useMemo(() => {
    if (!isDesktop || containerWidth <= 0) return 38;
    const available = containerWidth - leftStickyWidth - rightStatsWidth;
    return Math.max(28, available / daysInMonth);
  }, [isDesktop, containerWidth, leftStickyWidth, rightStatsWidth, daysInMonth]);

  const extraColsWidth = useMemo(() => {
    if (isPrivate || !showLongShifts) return 0;
    const restCol = 40; // 기본휴무 열
    const longCols = sortedLongShifts.length > 0 ? sortedLongShifts.length * 34 + 40 : 0;
    return restCol + longCols;
  }, [isPrivate, showLongShifts, sortedLongShifts.length]);

  const computedTableWidth = isDesktop
    ? leftStickyWidth + daysInMonth * dayColWidth + rightStatsWidth + extraColsWidth
    : undefined;

  const handleExportExcel = async () => {
    if (processedRoster.length === 0) {
      showToast('저장할 배차 데이터가 없습니다.', 'WARNING');
      return;
    }
    const routeName = route && route !== '미지정' ? route : '';
    const { exportPrivateRosterExcel, exportPublicRosterExcel } = await import(
      '../utils/excelExporter'
    );

    if (isPrivate) {
      await exportPrivateRosterExcel({
        year,
        month,
        route: routeName,
        daysArray,
        holidays,
        processedRoster,
        prevMonthRoster,
        dailyStats,
        hourlyWage,
        routeInfo,
        allRoutes,
        maxDriverOrder,
      });
    } else {
      await exportPublicRosterExcel({
        year,
        month,
        route: routeName,
        daysArray,
        holidays,
        processedRoster,
        dailyStats,
        hourlyWage,
        routeInfo,
        allRoutes,
        maxDriverOrder,
        sortedLongShifts,
      });
    }
  };

  const generalDimClass = isModalActive ? 'opacity-20' : '';

  const cornerActive1 = isModalActive
    ? 'z-[201] bg-white text-blue-800 ring-[3px] ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] rounded-lg'
    : 'z-50 bg-slate-300 text-slate-800 border-l-[2.5px] border-l-slate-700 border-r border-r-slate-400 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-600';
  const cornerActive2 = isModalActive
    ? 'z-[201] bg-white text-blue-800 ring-[3px] ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] rounded-lg'
    : 'z-50 bg-slate-200 text-slate-800 border-r border-r-slate-300 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-600';
  const cornerActive3 = isModalActive
    ? 'z-[201] bg-white text-blue-800 ring-[3px] ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] rounded-lg'
    : 'z-50 bg-slate-200 text-slate-800 border-r-[2px] border-r-slate-400 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-600';

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 font-sans overscroll-none relative">
      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-[500] max-w-lg w-[calc(100%-2rem)] sm:w-auto min-w-[320px] px-5 py-3.5 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.28)] border backdrop-blur-md flex items-start gap-3 animate-in fade-in slide-in-from-top-3 duration-200 ${
            toast.type === 'WARNING'
              ? 'bg-slate-900/95 border-rose-500/60 text-white'
              : 'bg-slate-900/95 border-emerald-500/50 text-white'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl shrink-0 mt-0.5 ${
              toast.type === 'WARNING'
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {toast.type === 'WARNING' ? (
              <AlertTriangle size={20} strokeWidth={2.5} />
            ) : (
              <CheckCircle2 size={20} strokeWidth={2.5} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-[14.5px] leading-snug tracking-tight">
              {toast.message}
            </p>
            {toast.subMessage && (
              <p className="text-[12.5px] font-bold text-slate-300 mt-1 leading-relaxed break-keep">
                {toast.subMessage}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors shrink-0"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {isModalActive && (
        <div
          className="fixed inset-0 bg-slate-900/80 z-[190]"
          onClick={() => setScheduleModalObj(null)}
        />
      )}

      <header
        className={`flex flex-nowrap items-center justify-between gap-1 xl:gap-1.5 px-2 sm:px-3 py-1.5 xl:py-2 bg-white border-b border-gray-200 shadow-sm shrink-0 relative overflow-hidden ${
          isModalActive ? 'z-[210] pointer-events-none' : 'z-50'
        }`}
      >
        <div className="flex items-center flex-nowrap gap-1 xl:gap-1.5 shrink-0">
          <div className="flex items-center bg-white border-[2px] border-slate-200 hover:border-blue-300 rounded-xl shadow-sm p-0.5 transition-colors shrink-0">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 2, 1))}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all active:scale-95"
            >
              <ChevronLeft size={16} strokeWidth={3} className="xl:w-[18px] xl:h-[18px]" />
            </button>
            <button
              onClick={() => setIsPickerOpen(true)}
              className="px-1.5 xl:px-2.5 flex items-center gap-1 xl:gap-1.5 font-black text-[13px] xl:text-[15.5px] text-slate-800 hover:text-blue-600 transition-colors tracking-tighter active:scale-95 whitespace-nowrap"
            >
              <CalendarDays size={15} strokeWidth={2.5} className="text-blue-500 hidden sm:block xl:w-[17px] xl:h-[17px]" />
              {year}년 {month}월
            </button>
            <button
              onClick={() => setCurrentDate(new Date(year, month, 1))}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all active:scale-95"
            >
              <ChevronRight size={16} strokeWidth={3} className="xl:w-[18px] xl:h-[18px]" />
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="h-[30px] xl:h-[36px] px-2 xl:px-3 flex items-center justify-center gap-0.5 xl:gap-1 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg xl:rounded-xl shadow-sm transition-all active:scale-95 text-[11.5px] xl:text-[13px] whitespace-nowrap shrink-0"
          >
            <Plus size={14} strokeWidth={3} className="xl:w-[15px] xl:h-[15px]" /> 추가
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="h-[30px] xl:h-[36px] px-2 xl:px-2.5 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white font-black rounded-lg xl:rounded-xl shadow-sm transition-all active:scale-95 text-[11.5px] xl:text-[13px] whitespace-nowrap shrink-0"
          >
            오늘
          </button>

          <button
            type="button"
            onClick={handleInitialSetupClick}
            className="h-[30px] xl:h-[36px] px-2 xl:px-3 flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg xl:rounded-xl shadow-sm transition-all active:scale-95 text-[11.5px] xl:text-[13px] whitespace-nowrap shrink-0"
          >
            <Wand2 size={13} strokeWidth={2.5} className="xl:w-[14px] xl:h-[14px]" /> 초기세팅
          </button>

          <div className="flex items-center bg-slate-100 rounded-lg xl:rounded-xl p-0.5 border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (undo()) showToast('이전 배차 상태로 되돌렸습니다.');
              }}
              disabled={!canUndo}
              title="실행 취소 (Ctrl+Z)"
              className={`h-[26px] xl:h-[30px] px-1.5 xl:px-2 rounded-md xl:rounded-lg flex items-center gap-1 font-extrabold text-[11.5px] xl:text-[12.5px] transition-all ${
                canUndo
                  ? 'text-slate-700 hover:bg-white hover:shadow-sm active:scale-95 cursor-pointer'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
            >
              <Undo2 size={13} strokeWidth={2.5} className="xl:w-[15px] xl:h-[15px]" />
              <span className="hidden 2xl:inline">되돌리기</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (redo()) showToast('작업을 다시 실행했습니다.');
              }}
              disabled={!canRedo}
              title="다시 실행 (Ctrl+Y)"
              className={`h-[26px] xl:h-[30px] px-1.5 xl:px-2 rounded-md xl:rounded-lg flex items-center transition-all ${
                canRedo
                  ? 'text-slate-700 hover:bg-white hover:shadow-sm active:scale-95 cursor-pointer'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
            >
              <Redo2 size={13} strokeWidth={2.5} className="xl:w-[15px] xl:h-[15px]" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1 xl:gap-2 min-w-0 flex-1 px-1">
          <Bus className="text-blue-600 hidden xl:block shrink-0" size={20} strokeWidth={2.5} />
          <h1 className="font-black text-[13px] sm:text-[14.5px] xl:text-[18px] 2xl:text-[20px] leading-none text-gray-800 tracking-tight whitespace-nowrap truncate">
            {route && route !== '미지정' && (
              <span className="mr-1">
                <span className="text-indigo-700">{route}</span> 노선
              </span>
            )}
            {year}년 {month}월 <span className="hidden lg:inline">근무 계획표</span>
          </h1>

          {saveStatus === 'SAVING' && (
            <span className="inline-flex items-center gap-1 px-1.5 xl:px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 font-extrabold text-[10.5px] xl:text-[11.5px] whitespace-nowrap shrink-0">
              <Loader2 size={11} className="animate-spin" /> 저장 중
            </span>
          )}
          {saveStatus === 'SAVED' && (
            <span className="inline-flex items-center gap-1 px-1.5 xl:px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-[10.5px] xl:text-[11.5px] whitespace-nowrap shrink-0">
              <CheckCircle2 size={11} strokeWidth={2.5} /> 저장됨
            </span>
          )}
          {saveStatus === 'ERROR' && (
            <span className="inline-flex items-center gap-1 px-1.5 xl:px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600 font-extrabold text-[10.5px] xl:text-[11.5px] whitespace-nowrap shrink-0">
              <AlertTriangle size={11} strokeWidth={2.5} /> 저장 실패
            </span>
          )}

          {totalWarningCount > 0 && (
            <button
              type="button"
              onClick={() =>
                setHighlightFilter(prev => (prev === 'WARNING' ? 'ALL' : 'WARNING'))
              }
              title="클릭하면 배차 주의(역교대·7일연속·중복·감차) 셀만 강조합니다"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[10.5px] xl:text-[11.5px] transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0 ${
                highlightFilter === 'WARNING'
                  ? 'bg-red-600 text-white ring-2 ring-red-300 shadow-sm'
                  : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
              }`}
            >
              <AlertTriangle size={11} strokeWidth={2.5} />
              주의 {totalWarningCount}건
            </button>
          )}
        </div>

        <div className="flex items-center flex-nowrap justify-end gap-1 xl:gap-1.5 shrink-0">
          <select
            value={highlightFilter}
            onChange={e => setHighlightFilter(e.target.value)}
            className={`h-[30px] xl:h-[36px] px-1.5 xl:px-2 rounded-lg xl:rounded-xl border font-extrabold text-[11px] xl:text-[12.5px] outline-none transition-colors cursor-pointer shrink-0 ${
              highlightFilter !== 'ALL'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <option value="ALL" className="bg-white text-slate-800">
              전체 보기
            </option>
            <option value="WARNING" className="bg-white text-red-600">
              ⚠️ 주의만
            </option>
            <option value="LEAVE" className="bg-white text-purple-700">
              🟣 연차만
            </option>
            <option value="REST" className="bg-white text-slate-700">
              ❌ 휴무만
            </option>
            {!isPrivate && (
              <>
                <option value="AM" className="bg-white text-orange-600">
                  🟠 오전만
                </option>
                <option value="PM" className="bg-white text-blue-600">
                  🔵 오후만
                </option>
              </>
            )}
          </select>

          <div className="relative flex items-center shrink-0">
            <Search size={12} className="absolute left-2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="성명·차번"
              className="w-[74px] xl:w-[96px] focus:w-[92px] xl:focus:w-[116px] h-[30px] xl:h-[36px] pl-5 pr-4 bg-slate-50 border border-slate-200 rounded-lg xl:rounded-xl text-[11.5px] xl:text-[12.5px] font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-400 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1 p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {!isPrivate && (
            <button
              onClick={() => setShowLongShifts(!showLongShifts)}
              className="h-[30px] xl:h-[36px] px-2 xl:px-2.5 flex items-center justify-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-extrabold rounded-lg xl:rounded-xl shadow-sm transition-all active:scale-95 text-[11.5px] xl:text-[12.5px] whitespace-nowrap shrink-0"
            >
              <LayoutList size={13} strokeWidth={2.5} className="xl:w-[15px] xl:h-[15px]" />
              {showLongShifts ? '감추기' : '추가표시'}
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="h-[30px] xl:h-[36px] px-2 xl:px-2.5 flex items-center justify-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-extrabold rounded-lg xl:rounded-xl shadow-sm transition-all active:scale-95 text-[11.5px] xl:text-[12.5px] whitespace-nowrap shrink-0"
          >
            <Download size={13} strokeWidth={2.5} className="text-emerald-600 xl:w-[15px] xl:h-[15px]" /> 엑셀저장
          </button>
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="h-[30px] xl:h-[36px] px-2 xl:px-2.5 flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-extrabold rounded-lg xl:rounded-xl shadow-sm transition-all active:scale-95 text-[11.5px] xl:text-[12.5px] whitespace-nowrap shrink-0"
          >
            <RotateCcw size={13} strokeWidth={3} className="text-red-500 xl:w-[15px] xl:h-[15px]" /> 초기화
          </button>
        </div>
      </header>

      {showLandscapePrompt && (
        <div className="bg-indigo-900 text-white px-3 py-2 flex items-center justify-between gap-2 text-[12.5px] font-bold shrink-0 z-50">
          <span>📱 배차표는 가로 화면에 최적화되어 있습니다.</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={forceEnterLandscape}
              className="px-2.5 py-1 bg-amber-400 text-slate-950 font-black rounded-lg text-[12px] active:scale-95"
            >
              가로모드 전환
            </button>
            <button
              type="button"
              onClick={dismissLandscapePrompt}
              className="px-2 py-1 bg-slate-700 text-slate-200 rounded-lg text-[11.5px]"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 bg-slate-100 p-0 sm:p-2 flex flex-col min-h-0 relative">
        {scale !== 1 && (
          <button
            type="button"
            onClick={resetScale}
            className="fixed bottom-[74px] right-4 z-[180] px-3 py-1.5 bg-slate-900/90 text-white font-black text-[12.5px] rounded-full shadow-lg border border-slate-700 active:scale-95"
          >
            🔍 {Math.round(scale * 100)}% (터치 시 100%)
          </button>
        )}

        <div
          ref={containerRef}
          className="flex-1 overflow-auto relative touch-pan-x touch-pan-y touch-pinch-zoom shadow-sm"
        >
          {/* border-separate border-spacing-0 적용: 스크롤 시 상/하단 고정행의 열 사이 1px 틈새로 본문 배차/빨간선이 비치는 현상 완전 차단 */}
          <table
            style={
              {
                zoom: scale,
                width: computedTableWidth ? `${computedTableWidth}px` : undefined,
              } as React.CSSProperties
            }
            className={`${
              !computedTableWidth ? 'w-max min-w-full' : ''
            } border-separate border-spacing-0 text-sm table-fixed ${
              isModalActive ? 'bg-slate-900' : 'bg-white'
            }`}
          >
            {/* colgroup으로 각 열의 정확한 고정 폭 지정 (추가표시 클릭 시에도 기존 열 너비 100% 유지) */}
            <colgroup>
              <col style={{ width: '30px' }} />
              <col style={{ width: '44px' }} />
              <col style={{ width: '62px' }} />
              {!isPrivate && showLongShifts && <col style={{ width: '40px' }} />}
              {daysArray.map(d => (
                <col key={`col-day-${d}`} style={{ width: `${dayColWidth}px` }} />
              ))}
              {rightStatsCols.map((w, idx) => (
                <col key={`col-stat-${idx}`} style={{ width: `${w}px` }} />
              ))}
              {!isPrivate &&
                showLongShifts &&
                sortedLongShifts.length > 0 && (
                  <>
                    {sortedLongShifts.map(s => (
                      <col key={`col-ls-${s}`} style={{ width: '34px' }} />
                    ))}
                    <col style={{ width: '40px' }} />
                  </>
                )}
            </colgroup>

            <thead
              className={`bg-slate-100 sticky top-0 ${
                isModalActive ? 'z-[200] pointer-events-none' : 'z-40'
              }`}
            >
              <tr className="border-0">
                <th
                  rowSpan={headerRowSpan}
                  className={`sticky left-0 w-[30px] py-1.5 font-black text-[11px] align-middle px-0.5 leading-tight ${cornerActive1}`}
                >
                  {isPrivate ? '조' : '순서'}
                </th>
                <th
                  rowSpan={headerRowSpan}
                  className={`sticky left-[30px] w-[44px] py-2 font-black text-[12.5px] align-middle tracking-tighter px-0.5 ${cornerActive2}`}
                >
                  차번
                </th>
                <th
                  rowSpan={headerRowSpan}
                  className={`sticky left-[74px] w-[62px] py-2 font-black text-[13.5px] align-middle tracking-tight px-0.5 ${cornerActive3}`}
                >
                  성명
                </th>

                {!isPrivate && showLongShifts && (
                  <th
                    rowSpan={headerRowSpan}
                    onClick={handleAutoExtractRestDaysUI}
                    title="클릭 시 미지정(-) 기사의 기본휴무만 자동 설정합니다 (이미 지정된 기본휴무는 유지)"
                    className={`py-2 border-r-[2px] border-r-slate-500 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-emerald-600 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-extrabold text-[11.5px] align-middle leading-tight cursor-pointer transition-colors select-none ${generalDimClass}`}
                  >
                    기본<br />휴무
                  </th>
                )}

                {daysArray.map((day, idx) => {
                  const dayType = getDayType(year, month, day, holidays);
                  const isToday = todayDay === day;
                  const isLastDay = idx === daysArray.length - 1;

                  let bgClass = isToday ? 'bg-blue-100' : 'bg-white';
                  let dateColor = isToday ? 'text-blue-700' : 'text-slate-800';
                  let dowColor = isToday ? 'text-blue-600' : 'text-slate-500';

                  if (dayType === 'JEOLNAL') {
                    bgClass = 'bg-red-100';
                    dateColor = 'text-red-600';
                    dowColor = 'text-red-500';
                  } else if (dayType === 'SUN') {
                    bgClass = 'bg-slate-200';
                  } else if (dayType === 'SAT') {
                    bgClass = 'bg-slate-100';
                  }

                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isTargetDate = scheduleModalObj?.day === day;
                  const thDimClass = isModalActive && !isTargetDate ? 'opacity-20' : '';
                  const rightBorderClass = isLastDay
                    ? 'border-r-[2.5px] border-r-slate-700'
                    : 'border-r border-r-slate-200';

                  const thActiveClass = isTargetDate
                    ? 'z-[201] bg-white ring-[3px] ring-blue-500 shadow-[0_0_20px_5px_rgba(59,130,246,0.8)] scale-[1.15] relative rounded-lg overflow-visible'
                    : isToday
                    ? `${rightBorderClass} border-t-[2.5px] border-t-blue-600 border-b-[2.5px] border-b-blue-600 overflow-hidden`
                    : `${rightBorderClass} border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-600 overflow-hidden`;

                  return (
                    <th
                      key={day}
                      rowSpan={headerRowSpan}
                      className={`py-1.5 text-center align-top ${bgClass} ${thDimClass} ${thActiveClass}`}
                    >
                      <div className="flex flex-col items-center justify-start h-full gap-0.5 pt-0.5 px-0 w-full">
                        <span className={`text-[13.5px] xl:text-[14.5px] font-black leading-none ${dateColor}`}>
                          {day}
                        </span>
                        <span className={`text-[10px] xl:text-[11px] font-bold leading-none ${dowColor}`}>
                          {getDayOfWeekText(day)}
                        </span>
                        {dayType === 'JEOLNAL' && holidays[dateStr] ? (
                          <span
                            className="text-[8.5px] font-extrabold text-red-500 tracking-tighter w-full mt-0.5 leading-tight truncate"
                            title={holidays[dateStr]}
                          >
                            {holidays[dateStr]}
                          </span>
                        ) : isToday ? (
                          <span className="text-[8px] font-black bg-blue-600 text-white px-0.5 rounded mt-0.5 leading-tight">
                            오늘
                          </span>
                        ) : null}
                      </div>
                    </th>
                  );
                })}

                {isPrivate ? (
                  <>
                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r border-r-slate-300 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-600 bg-slate-200 text-slate-800 font-extrabold text-[12px] align-middle leading-tight ${generalDimClass}`}
                    >
                      합<br />계
                    </th>
                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r border-r-rose-200 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-rose-400 bg-rose-50 text-rose-700 font-extrabold text-[12px] align-middle leading-tight ${generalDimClass}`}
                    >
                      절<br />근로
                    </th>
                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r-[2.5px] border-r-slate-700 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-purple-400 bg-purple-100 text-purple-800 font-extrabold text-[12px] align-middle leading-tight ${generalDimClass}`}
                    >
                      복격<br />근로
                    </th>
                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r-[2.5px] border-r-slate-700 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-800 bg-slate-700 text-white font-extrabold text-[13.5px] align-middle ${generalDimClass}`}
                    >
                      예상급여
                    </th>
                  </>
                ) : (
                  <>
                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r border-r-slate-300 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-600 bg-slate-200 text-slate-800 font-extrabold text-[11.5px] xl:text-[12px] align-middle leading-tight ${generalDimClass}`}
                    >
                      총<br />근로
                    </th>
                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r border-r-orange-200 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-orange-400 bg-orange-50 text-orange-700 font-extrabold text-[11.5px] xl:text-[12px] align-middle leading-tight ${generalDimClass}`}
                    >
                      오<br />전
                    </th>
                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r-[2.5px] border-r-slate-700 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-blue-400 bg-blue-50 text-blue-700 font-extrabold text-[11.5px] xl:text-[12px] align-middle leading-tight ${generalDimClass}`}
                    >
                      오<br />후
                    </th>

                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r border-r-emerald-300 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-emerald-500 bg-emerald-100 text-emerald-950 font-extrabold text-[11.5px] xl:text-[12px] align-middle leading-tight ${generalDimClass}`}
                    >
                      소정<br />근로
                    </th>
                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r-[2.5px] border-r-slate-700 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-emerald-600 bg-emerald-50 text-emerald-900 font-extrabold text-[11.5px] xl:text-[12px] align-middle leading-tight ${generalDimClass}`}
                    >
                      고정<br />휴무
                    </th>

                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r border-r-rose-200 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-rose-400 bg-rose-50 text-rose-700 font-extrabold text-[11.5px] xl:text-[12px] align-middle leading-tight ${generalDimClass}`}
                    >
                      절<br />근로
                    </th>
                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r border-r-orange-200 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-orange-400 bg-orange-50 text-orange-700 font-extrabold text-[11.5px] xl:text-[12px] align-middle leading-tight ${generalDimClass}`}
                    >
                      연장<br />근로
                    </th>
                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r-[2.5px] border-r-slate-700 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-red-400 bg-red-100 text-red-800 font-extrabold text-[11.5px] xl:text-[12px] align-middle leading-tight ${generalDimClass}`}
                    >
                      추가<br />합계
                    </th>

                    <th
                      rowSpan={headerRowSpan}
                      className={`py-2 border-r-[2.5px] border-r-slate-700 border-t-[2.5px] border-t-slate-700 border-b-[2.5px] border-b-slate-800 bg-slate-700 text-white font-extrabold text-[12.5px] xl:text-[13.5px] align-middle ${generalDimClass}`}
                    >
                      예상급여
                    </th>

                    {!isPrivate && showLongShifts && sortedLongShifts.length > 0 && (
                      <th
                        colSpan={sortedLongShifts.length + 1}
                        className={`py-1 border-r-[2.5px] border-r-slate-700 border-t-[2.5px] border-t-slate-700 border-b border-b-amber-300 bg-amber-100 text-amber-950 font-extrabold text-[13px] align-middle leading-tight text-center ${generalDimClass}`}
                      >
                        긴근무 순번
                      </th>
                    )}
                  </>
                )}
              </tr>

              {!isPrivate && showLongShifts && sortedLongShifts.length > 0 && (
                <tr className="border-0">
                  {sortedLongShifts.map(shift => (
                    <th
                      key={shift}
                      className={`py-1 border-r border-r-amber-200 border-b-[2.5px] border-b-slate-600 bg-amber-50 text-amber-800 font-extrabold text-[12px] align-middle leading-tight text-center ${generalDimClass}`}
                    >
                      {shift}
                    </th>
                  ))}
                  <th
                    className={`py-1 border-r-[2.5px] border-r-slate-700 border-b-[2.5px] border-b-slate-600 bg-amber-200 text-amber-950 font-extrabold text-[12px] align-middle leading-tight text-center ${generalDimClass}`}
                  >
                    합계
                  </th>
                </tr>
              )}
            </thead>

            <tbody>
              {isRosterLoading || isLoading ? (
                <tr>
                  <td
                    colSpan={daysInMonth + 13}
                    className="text-center py-12 text-slate-500 font-bold border-b border-slate-200 text-[15px]"
                  >
                    배차 데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : processedRoster.length === 0 ? (
                <tr>
                  <td
                    colSpan={daysInMonth + 13}
                    className="text-center py-12 text-slate-400 font-bold border-b border-slate-200 text-[15px]"
                  >
                    등록된 배차 데이터가 없습니다. 상단 '초기세팅' 또는 '추가' 버튼을 눌러주세요.
                  </td>
                </tr>
              ) : isPrivate ? (
                <>
                  {processedRoster.map((busGroup, bIdx) => (
                    <RosterTableRow
                      key={`A-${bIdx}`}
                      bIdx={bIdx}
                      dIdx={0}
                      busGroup={busGroup}
                      driver={busGroup.drivers[0]}
                      rowStats={rowStatsByGroup[bIdx]?.[0]}
                      cellWarnings={publicWarningsByGroup[bIdx]?.[0]}
                      todayDay={todayDay}
                      highlightFilter={highlightFilter}
                      searchQuery={searchQuery}
                      year={year}
                      month={month}
                      daysArray={daysArray}
                      holidays={holidays}
                      rosterDataLength={rosterData.length}
                      isLastInGroup={bIdx === processedRoster.length - 1}
                      nameAlign="left"
                      isMenuActive={activeMenuIndex?.bIdx === bIdx && activeMenuIndex?.dIdx === 0}
                      isDriverEditing={editingDriver?.bIdx === bIdx && editingDriver?.dIdx === 0}
                      editingBusIndex={editingBusIndex}
                      scheduleModalObj={scheduleModalObj}
                      hourlyWage={hourlyWage}
                      maxSalary={maxSalary}
                      minSalary={minSalary}
                      showLongShifts={false}
                      sortedLongShifts={[]}
                      routeType="PRIVATE"
                      prevMonthLastDayWork={getExternalDayWork(
                        prevMonthRoster,
                        busGroup.drivers[0]?.name?.trim() || '',
                        bIdx,
                        0,
                        prevMonthDaysCount
                      )}
                      nextMonthFirstDayWork={getExternalDayWork(
                        nextMonthRoster,
                        busGroup.drivers[0]?.name?.trim() || '',
                        bIdx,
                        0,
                        1
                      )}
                      duplicateShifts={duplicateShifts}
                      routeInfo={routeInfo}
                      allRoutes={allRoutes}
                      maxDriverOrder={maxDriverOrder}
                      setActiveMenuIndex={setActiveMenuIndex}
                      setEditingBusIndex={setEditingBusIndex}
                      setEditingDriver={setEditingDriver}
                      setScheduleModalObj={setScheduleModalObj}
                      moveRowUp={moveRowUp}
                      moveRowDown={moveRowDown}
                      handleRowDelete={handleRowDelete}
                      handleBusEditConfirmUI={handleBusEditConfirmUI}
                      handleDriverEditConfirmUI={handleDriverEditConfirmUI}
                      handleClearDriverSchedulesUI={handleClearDriverSchedulesUI}
                      handleDefaultRestSaveUI={handleDefaultRestSaveUI}
                      onOpenShareModal={handleOpenShareModal}
                      onShowToast={showToast}
                    />
                  ))}
                  {processedRoster.map(
                    (busGroup, bIdx) =>
                      busGroup.drivers[1] && (
                        <RosterTableRow
                          key={`B-${bIdx}`}
                          bIdx={bIdx}
                          dIdx={1}
                          busGroup={busGroup}
                          driver={busGroup.drivers[1]}
                          rowStats={rowStatsByGroup[bIdx]?.[1]}
                          cellWarnings={publicWarningsByGroup[bIdx]?.[1]}
                          todayDay={todayDay}
                          highlightFilter={highlightFilter}
                          searchQuery={searchQuery}
                          year={year}
                          month={month}
                          daysArray={daysArray}
                          holidays={holidays}
                          rosterDataLength={rosterData.length}
                          isLastInGroup={bIdx === processedRoster.length - 1}
                          nameAlign="right"
                          isMenuActive={activeMenuIndex?.bIdx === bIdx && activeMenuIndex?.dIdx === 1}
                          isDriverEditing={editingDriver?.bIdx === bIdx && editingDriver?.dIdx === 1}
                          editingBusIndex={editingBusIndex}
                          scheduleModalObj={scheduleModalObj}
                          hourlyWage={hourlyWage}
                          maxSalary={maxSalary}
                          minSalary={minSalary}
                          showLongShifts={false}
                          sortedLongShifts={[]}
                          routeType="PRIVATE"
                          prevMonthLastDayWork={getExternalDayWork(
                            prevMonthRoster,
                            busGroup.drivers[1]?.name?.trim() || '',
                            bIdx,
                            1,
                            prevMonthDaysCount
                          )}
                          nextMonthFirstDayWork={getExternalDayWork(
                            nextMonthRoster,
                            busGroup.drivers[1]?.name?.trim() || '',
                            bIdx,
                            1,
                            1
                          )}
                          duplicateShifts={duplicateShifts}
                          routeInfo={routeInfo}
                          allRoutes={allRoutes}
                          maxDriverOrder={maxDriverOrder}
                          setActiveMenuIndex={setActiveMenuIndex}
                          setEditingBusIndex={setEditingBusIndex}
                          setEditingDriver={setEditingDriver}
                          setScheduleModalObj={setScheduleModalObj}
                          moveRowUp={moveRowUp}
                          moveRowDown={moveRowDown}
                          handleRowDelete={handleRowDelete}
                          handleBusEditConfirmUI={handleBusEditConfirmUI}
                          handleDriverEditConfirmUI={handleDriverEditConfirmUI}
                          handleClearDriverSchedulesUI={handleClearDriverSchedulesUI}
                          handleDefaultRestSaveUI={handleDefaultRestSaveUI}
                          onOpenShareModal={handleOpenShareModal}
                          onShowToast={showToast}
                        />
                      )
                  )}
                </>
              ) : (
                (() => {
                  let spRunningCount = 0;

                  return processedRoster.map((busGroup, bIdx) => {
                    const isSingleSpGroup =
                      busGroup.busNo.trim().toUpperCase() === 'SP' && busGroup.drivers.length === 1;

                    let currentSpOrder = -1;
                    let pairedWithNextSp = false;

                    if (isSingleSpGroup) {
                      currentSpOrder = spRunningCount;
                      spRunningCount++;

                      if (currentSpOrder % 2 === 0) {
                        const nextGroup = processedRoster[bIdx + 1];
                        if (
                          nextGroup &&
                          nextGroup.busNo.trim().toUpperCase() === 'SP' &&
                          nextGroup.drivers.length === 1
                        ) {
                          pairedWithNextSp = true;
                        }
                      }
                    } else {
                      spRunningCount = 0;
                    }

                    return (
                      <React.Fragment key={bIdx}>
                        {busGroup.drivers.map((driver, dIdx) => {
                          const nameAlign: 'left' | 'right' = isSingleSpGroup
                            ? currentSpOrder % 2 === 0
                              ? 'left'
                              : 'right'
                            : dIdx % 2 === 0
                            ? 'left'
                            : 'right';

                          const isLastInGroup = isSingleSpGroup
                            ? !pairedWithNextSp
                            : dIdx === busGroup.drivers.length - 1;

                          return (
                            <RosterTableRow
                              key={`${bIdx}-${dIdx}`}
                              bIdx={bIdx}
                              dIdx={dIdx}
                              busGroup={busGroup}
                              driver={driver}
                              rowStats={rowStatsByGroup[bIdx]?.[dIdx]}
                              cellWarnings={publicWarningsByGroup[bIdx]?.[dIdx]}
                              todayDay={todayDay}
                              highlightFilter={highlightFilter}
                              searchQuery={searchQuery}
                              year={year}
                              month={month}
                              daysArray={daysArray}
                              holidays={holidays}
                              rosterDataLength={rosterData.length}
                              isLastInGroup={isLastInGroup}
                              nameAlign={nameAlign}
                              isMenuActive={
                                activeMenuIndex?.bIdx === bIdx && activeMenuIndex?.dIdx === dIdx
                              }
                              isDriverEditing={
                                editingDriver?.bIdx === bIdx && editingDriver?.dIdx === dIdx
                              }
                              editingBusIndex={editingBusIndex}
                              scheduleModalObj={scheduleModalObj}
                              hourlyWage={hourlyWage}
                              maxSalary={maxSalary}
                              minSalary={minSalary}
                              showLongShifts={showLongShifts}
                              sortedLongShifts={sortedLongShifts}
                              routeType="PUBLIC"
                              prevMonthLastDayWork={getExternalDayWork(
                                prevMonthRoster,
                                driver.name?.trim() || '',
                                bIdx,
                                dIdx,
                                prevMonthDaysCount
                              )}
                              nextMonthFirstDayWork={getExternalDayWork(
                                nextMonthRoster,
                                driver.name?.trim() || '',
                                bIdx,
                                dIdx,
                                1
                              )}
                              duplicateShifts={duplicateShifts}
                              routeInfo={routeInfo}
                              allRoutes={allRoutes}
                              maxDriverOrder={maxDriverOrder}
                              setActiveMenuIndex={setActiveMenuIndex}
                              setEditingBusIndex={setEditingBusIndex}
                              setEditingDriver={setEditingDriver}
                              setScheduleModalObj={setScheduleModalObj}
                              moveRowUp={moveRowUp}
                              moveRowDown={moveRowDown}
                              handleRowDelete={handleRowDelete}
                              handleBusEditConfirmUI={handleBusEditConfirmUI}
                              handleDriverEditConfirmUI={handleDriverEditConfirmUI}
                              handleClearDriverSchedulesUI={handleClearDriverSchedulesUI}
                              handleDefaultRestSaveUI={handleDefaultRestSaveUI}
                              onOpenShareModal={handleOpenShareModal}
                              onShowToast={showToast}
                            />
                          );
                        })}
                      </React.Fragment>
                    );
                  });
                })()
              )}
            </tbody>

            {!isRosterLoading && !isLoading && processedRoster.length > 0 && (
              <tfoot
                className={`lg:sticky lg:bottom-0 ${
                  isModalActive
                    ? 'z-10 opacity-20 pointer-events-none'
                    : 'z-40 lg:shadow-[0_-4px_12px_rgba(0,0,0,0.08)]'
                }`}
              >
                <DailySummary
                  daysArray={daysArray}
                  dailyStats={dailyStats}
                  routeInfo={routeInfo}
                  year={year}
                  month={month}
                  holidays={holidays}
                  showLongShifts={showLongShifts}
                  sortedLongShifts={sortedLongShifts}
                  isPrivate={isPrivate}
                  todayDay={todayDay}
                  onCellClick={(day, focusType) => setDailyCheckTarget({ day, focusType })}
                />
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <MonthPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        currentYear={year}
        currentMonth={month}
        onSelect={handleSelectMonth}
      />
      <AddDriverModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={addBusGroup}
        isPrivate={isPrivate}
      />

      <ScheduleInputModal
        modalObj={scheduleModalObj}
        onClose={() => setScheduleModalObj(null)}
        onApply={handleScheduleApplyUI}
        maxDriverOrder={maxDriverOrder}
        routeInfo={routeInfo}
        takenAm={takenAm}
        takenPm={takenPm}
        takenHolderMap={takenHolderMap}
        onSwapSchedule={handleSwapScheduleUI}
        isPrivate={isPrivate}
        currentWork={selectedCellInfo.work}
        baseWork={selectedCellInfo.baseWork}
        hasBaseSchedule={selectedCellInfo.hasBaseSchedule}
        onOpenSubstitutes={() => setIsSubstituteModalOpen(true)}
      />

      <SubstituteListModal
        isOpen={isSubstituteModalOpen}
        onClose={() => setIsSubstituteModalOpen(false)}
        day={scheduleModalObj?.day || 0}
        targetWork={selectedCellInfo.work}
        targetDriverName={selectedCellInfo.driverName}
        candidates={substituteCandidates}
        onAssign={handleAssignSubstituteUI}
      />

      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onResetSchedules={resetAllSchedules}
        onClearAll={clearAllData}
      />

      <DriverShareModal
        isOpen={!!shareTarget}
        onClose={() => setShareTarget(null)}
        driver={
          shareTarget
            ? processedRoster[shareTarget.bIdx]?.drivers?.[shareTarget.dIdx] || null
            : null
        }
        busNo={shareTarget ? processedRoster[shareTarget.bIdx]?.busNo || '' : ''}
        teamLabel={shareTarget ? (shareTarget.dIdx === 0 ? 'A조' : 'B조') : undefined}
        route={route || ''}
        year={year}
        month={month}
        daysArray={daysArray}
        holidays={holidays}
        rowStats={
          shareTarget
            ? rowStatsByGroup[shareTarget.bIdx]?.[shareTarget.dIdx]
            : undefined
        }
        isPrivate={isPrivate}
        onCopied={msg => showToast(msg, 'SUCCESS')}
      />

      <InitialSetupModal
        isOpen={isInitialSetupModalOpen}
        hasExistingData={hasAnyScheduleData}
        isEmptyRoster={processedRoster.length === 0}
        isPrivate={isPrivate}
        onClose={() => setIsInitialSetupModalOpen(false)}
        onConfirmSetup={handleConfirmInitialSetup}
      />

      <DailyShiftCheckModal
        isOpen={!!dailyCheckTarget}
        day={dailyCheckTarget?.day ?? null}
        focusType={dailyCheckTarget?.focusType}
        year={year}
        month={month}
        holidays={holidays}
        routeInfo={routeInfo}
        allRoutes={allRoutes}
        maxShiftCount={maxShiftCount}
        rosterData={rosterData}
        isPrivate={isPrivate}
        onClose={() => setDailyCheckTarget(null)}
        onOpenCellModal={(bIdx, dIdx, day, dayType) =>
          setScheduleModalObj({ bIdx, dIdx, day, dayType })
        }
      />
    </div>
  );
}