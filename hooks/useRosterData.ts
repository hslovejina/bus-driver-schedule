// 파일 위치: hooks/useRosterData.ts
import { useState, useMemo, useEffect, useCallback } from 'react';
import { isNormalPrivateShift, setRuntimePayConfig, type DriverInfo } from '../utils/calculator';

export type { DriverInfo };

export type BusGroup = {
  busNo: string;
  drivers: DriverInfo[];
};

export type SaveStatus = 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';

const DOW_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function cloneRoster(data: BusGroup[]): BusGroup[] {
  return JSON.parse(JSON.stringify(data));
}

function isActualPublicWork(work: string | undefined): boolean {
  if (!work) return false;
  const w = work.trim();
  if (!w) return false;
  if (['신청휴무', '휴무', 'x', 'X', '-', '연차', '연'].includes(w)) return false;
  return true;
}

// 구간(minOrder ~ maxOrder) 내에서 순번을 steps만큼 전진시키는 도우미 함수
function advanceInZone(num: number, steps: number, minOrder: number, maxOrder: number): number {
  const zoneLen = maxOrder - minOrder + 1;
  if (zoneLen <= 0) return num;
  const clamped = num >= minOrder && num <= maxOrder ? num : minOrder + ((num - 1) % zoneLen);
  return minOrder + ((((clamped - minOrder + steps) % zoneLen) + zoneLen) % zoneLen);
}

// 스케줄 데이터를 분석해 가장 많이 쉰 연속 요일 2개(고정휴무)를 자동 추출하는 도우미 함수
function inferDefaultRestDaysFromSchedules(
  schedules: Record<string, string> | undefined,
  targetYear: number,
  targetMonth: number
): string[] {
  if (!schedules) return [];
  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();

  let hasActualWork = false;
  for (let i = 1; i <= daysInTargetMonth; i++) {
    const w = (schedules[String(i)] || '').trim();
    if (w && !['x', 'X', '-', '휴무', '신청휴무'].includes(w)) {
      hasActualWork = true;
      break;
    }
  }
  if (!hasActualWork) return [];

  const restCounts = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 1; i <= daysInTargetMonth; i++) {
    const d = new Date(targetYear, targetMonth - 1, i);
    const w = (schedules[String(i)] || '').trim();
    if (!w || ['x', 'X', '-', '휴무', '신청휴무'].includes(w)) {
      restCounts[d.getDay()]++;
    }
  }

  let maxRestCount = -1;
  let maxRestDay = -1;
  for (let i = 0; i < 7; i++) {
    if (restCounts[i] > maxRestCount) {
      maxRestCount = restCounts[i];
      maxRestDay = i;
    }
  }

  const prevDay = (maxRestDay - 1 + 7) % 7;
  const nextDay = (maxRestDay + 1) % 7;
  const pair =
    restCounts[prevDay] >= restCounts[nextDay] ? [prevDay, maxRestDay] : [maxRestDay, nextDay];

  return [DOW_NAMES[pair[0]], DOW_NAMES[pair[1]]];
}

// 공공관리제: 실제 근무(schedules)를 최우선 반영하되 연차/휴무 등으로 빈 날은 초기세팅 원본(baseSchedules)으로 보완한 맵 생성
function buildEffectiveScheduleMap(drv: DriverInfo | null | undefined): Record<string, string> {
  if (!drv) return {};
  const base = drv.baseSchedules || {};
  const actual = drv.schedules || {};
  const merged: Record<string, string> = { ...base };
  Object.entries(actual).forEach(([dayKey, val]) => {
    const trimmed = (val || '').trim();
    if (/^(전|후)\d+$/.test(trimmed)) {
      merged[dayKey] = trimmed;
    }
  });
  return merged;
}

// 민영제: 실제 근무(schedules)의 정규 순번을 우선 반영하고 휴무/대근/지원 등으로 비거나 변형된 날은 baseSchedules로 보완
function buildPrivateEffectiveScheduleMap(
  drv: DriverInfo | null | undefined,
  allRoutes: { name: string; routeType: string }[],
  maxShift: number
): Record<string, string> {
  if (!drv) return {};
  const base = drv.baseSchedules || {};
  const actual = drv.schedules || {};
  const merged: Record<string, string> = { ...base };
  Object.entries(actual).forEach(([dayKey, val]) => {
    const trimmed = (val || '').trim();
    if (isNormalPrivateShift(trimmed, allRoutes, maxShift)) {
      merged[dayKey] = trimmed;
    }
  });
  return merged;
}

export function useRosterData(year: number, month: number, daysArray: number[]) {
  const [rosterData, setRosterData] = useState<BusGroup[]>([]);
  const [pastHistory, setPastHistory] = useState<BusGroup[][]>([]);
  const [futureHistory, setFutureHistory] = useState<BusGroup[][]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('IDLE');

  const [isRosterLoading, setIsRosterLoading] = useState(true);
  const [route, setRoute] = useState<string | null>(null);
  const [hourlyWage, setHourlyWage] = useState<number>(16911);
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [allRoutes, setAllRoutes] = useState<{ name: string; routeType: string }[]>([]);

  const [prevMonthRoster, setPrevMonthRoster] = useState<BusGroup[]>([]);
  const [nextMonthRoster, setNextMonthRoster] = useState<BusGroup[]>([]);

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

  const getShiftForDate = useCallback(
    (
      targetDateObj: Date,
      targetBIdx: number,
      targetDIdx: number,
      anchorRef: { bIdx: number; dIdx: number; shift: number; dateObj: Date },
      totalBuses: number
    ) => {
      const diffMs = targetDateObj.getTime() - anchorRef.dateObj.getTime();
      const diffDays = Math.round(diffMs / 86400000);

      const isWorkingDay = Math.abs(diffDays % 2) === Math.abs((targetDIdx - anchorRef.dIdx) % 2);
      if (!isWorkingDay) return null;

      const shiftOffset = Math.floor((diffDays + anchorRef.dIdx) / 2);
      const busOffset = targetBIdx - anchorRef.bIdx;
      const rawShift = anchorRef.shift + busOffset + shiftOffset;

      return ((((rawShift - 1) % totalBuses) + totalBuses) % totalBuses) + 1;
    },
    []
  );

  useEffect(() => {
    const fetchRouteAndAllRoutes = async () => {
      try {
        const routesRes = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'GET_ROUTES' }),
        });
        if (routesRes.ok) {
          const routesData = await routesRes.json();
          if (Array.isArray(routesData)) {
            setAllRoutes(routesData);
          }
        }
      } catch (e) {
        console.error('전체 노선 목록 로딩 실패:', e);
      }

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
    fetchRouteAndAllRoutes();
  }, []);

  useEffect(() => {
    if (!route) return;

    const fetchRoster = async () => {
      setIsRosterLoading(true);
      setPastHistory([]);
      setFutureHistory([]);
      setSaveStatus('IDLE');
      try {
        const prevDate = new Date(year, month - 2, 1);
        const prevYearMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        const nextDate = new Date(year, month, 1);
        const nextYearMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

        const [res, prevRes, nextRes] = await Promise.all([
          fetch(`/api/roster?route=${encodeURIComponent(route)}&yearMonth=${yearMonth}`),
          fetch(`/api/roster?route=${encodeURIComponent(route)}&yearMonth=${prevYearMonth}`),
          fetch(`/api/roster?route=${encodeURIComponent(route)}&yearMonth=${nextYearMonth}`),
        ]);

        const [data, prevData, nextDataObj] = await Promise.all([
          res.ok ? res.json() : null,
          prevRes.ok ? prevRes.json() : null,
          nextRes.ok ? nextRes.json() : null,
        ]);

        if (data) {
          setRosterData(data.rosterData || []);
          setHourlyWage(data.hourlyWage || 16911);
          setRouteInfo(data.routeInfo || null);

          // ✨ 서버에서 받아온 페이 조견표 설정을 계산기에 등록합니다.
          if (data.payConfig) {
            setRuntimePayConfig(data.payConfig);
          }
        }
        if (prevData) {
          setPrevMonthRoster(prevData.rosterData || []);
        }
        if (nextDataObj) {
          setNextMonthRoster(nextDataObj.rosterData || []);
        }
      } catch (error) {
        console.error('배차표 로딩 실패:', error);
      } finally {
        setIsRosterLoading(false);
      }
    };
    fetchRoster();
  }, [yearMonth, route, year, month]);

  const saveToServer = useCallback(
    async (newData: BusGroup[]) => {
      if (!route) return;
      setSaveStatus('SAVING');
      try {
        const res = await fetch('/api/roster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'SAVE', route, yearMonth, rosterData: newData, hourlyWage }),
        });
        if (res.ok) {
          setSaveStatus('SAVED');
        } else {
          setSaveStatus('ERROR');
        }
      } catch (error) {
        console.error('배차표 저장 실패:', error);
        setSaveStatus('ERROR');
      }
    },
    [route, yearMonth, hourlyWage]
  );

  const updateDataAndSave = useCallback(
    (newData: BusGroup[]) => {
      setPastHistory(prev => [...prev.slice(-19), cloneRoster(rosterData)]);
      setFutureHistory([]);
      setRosterData(newData);
      saveToServer(newData);
    },
    [rosterData, saveToServer]
  );

  const undo = useCallback(() => {
    if (pastHistory.length === 0) return false;
    const previous = pastHistory[pastHistory.length - 1];
    setPastHistory(prev => prev.slice(0, -1));
    setFutureHistory(prev => [cloneRoster(rosterData), ...prev.slice(0, 19)]);
    setRosterData(previous);
    saveToServer(previous);
    return true;
  }, [pastHistory, rosterData, saveToServer]);

  const redo = useCallback(() => {
    if (futureHistory.length === 0) return false;
    const next = futureHistory[0];
    setFutureHistory(prev => prev.slice(1));
    setPastHistory(prev => [...prev.slice(-19), cloneRoster(rosterData)]);
    setRosterData(next);
    saveToServer(next);
    return true;
  }, [futureHistory, rosterData, saveToServer]);

  const processedRoster = useMemo(() => {
    let busCounter = 1;
    return rosterData.map(group => {
      const isNumeric = /^\d+$/.test(group.busNo.trim());
      return { ...group, displayNo: isNumeric ? busCounter++ : '' };
    });
  }, [rosterData]);

  const maxDriverOrder = useMemo(() => {
    let max = 0;
    rosterData.forEach(group => {
      const isNumeric = /^\d+$/.test(group.busNo.trim());
      if (isNumeric) max++;
    });
    return max > 0 ? max : 1;
  }, [rosterData]);

  const dailyStats = useMemo(() => {
    const stats: Record<number, { am: number; pm: number; total: number }> = {};
    const isPrivate = routeInfo?.routeType === 'PRIVATE';
    const maxShift = routeInfo?.weekdayCount || maxDriverOrder || 50;

    daysArray.forEach(day => {
      let am = 0;
      let pm = 0;
      rosterData.forEach(group => {
        group.drivers.forEach(driver => {
          const work = driver.schedules[String(day)];
          if (work) {
            if (!isPrivate) {
              if (work.includes('전') || work.includes('오전')) am++;
              if (work.includes('후') || work.includes('오후')) pm++;
            } else {
              if (isNormalPrivateShift(work, allRoutes, maxShift)) {
                am++;
              }
            }
          }
        });
      });
      stats[day] = { am, pm, total: am + pm };
    });
    return stats;
  }, [rosterData, daysArray, routeInfo, maxDriverOrder, allRoutes]);

  const addBusGroup = (type: 'BUS' | 'SP', busNo: string) => {
    const trimmedBusNo = busNo.trim();
    if (type === 'BUS') {
      const isDuplicate = rosterData.some(group => group.busNo === trimmedBusNo);
      if (isDuplicate) return { success: false, duplicate: true };
    }

    const isPrivate = routeInfo?.routeType === 'PRIVATE';

    const newEntry: BusGroup = {
      busNo: type === 'SP' ? 'SP' : trimmedBusNo,
      drivers:
        type === 'SP'
          ? [{ name: '새 기사', schedules: {}, baseSchedules: {}, defaultRestDays: [] }]
          : isPrivate
          ? [
              { name: 'A조 기사', schedules: {}, baseSchedules: {} },
              { name: 'B조 기사', schedules: {}, baseSchedules: {} },
            ]
          : [
              { name: '오전 기사', schedules: {}, baseSchedules: {}, defaultRestDays: [] },
              { name: '오후 기사', schedules: {}, baseSchedules: {}, defaultRestDays: [] },
            ],
    };

    updateDataAndSave([...rosterData, newEntry]);
    return { success: true };
  };

  const moveRowUp = (index: number) => {
    if (index === 0) return;
    const newData = cloneRoster(rosterData);
    [newData[index - 1], newData[index]] = [newData[index], newData[index - 1]];
    updateDataAndSave(newData);
  };

  const moveRowDown = (index: number) => {
    if (index === rosterData.length - 1) return;
    const newData = cloneRoster(rosterData);
    [newData[index], newData[index + 1]] = [newData[index + 1], newData[index]];
    updateDataAndSave(newData);
  };

  const deleteRow = (index: number) => {
    const newData = rosterData.filter((_, i) => i !== index);
    updateDataAndSave(newData);
  };

  const updateDriverName = (bIdx: number, dIdx: number, newName: string) => {
    const newData = cloneRoster(rosterData);
    const newDrivers = [...newData[bIdx].drivers];
    const trimmedName = newName.trim();

    if (!trimmedName) {
      newDrivers[dIdx] = { ...newDrivers[dIdx], name: '' };
    } else {
      const newSchedules = { ...newDrivers[dIdx].schedules };
      const isPrivate = routeInfo?.routeType === 'PRIVATE';
      const maxShift = routeInfo?.weekdayCount || maxDriverOrder || 50;

      if (isPrivate && Object.keys(newSchedules).length === 0) {
        let anchorRef: any = null;

        for (let day = 1; day <= daysArray.length; day++) {
          for (let b = 0; b < rosterData.length; b++) {
            for (let d = 0; d < rosterData[b].drivers.length; d++) {
              if (rosterData[b].drivers[d].name.trim() !== '') {
                const work = rosterData[b].drivers[d].schedules[String(day)];
                if (work && isNormalPrivateShift(work, allRoutes, maxShift)) {
                  anchorRef = {
                    bIdx: b,
                    dIdx: d,
                    shift: parseInt(work, 10),
                    dateObj: new Date(year, month - 1, day),
                  };
                  break;
                }
              }
            }
            if (anchorRef) break;
          }
          if (anchorRef) break;
        }

        if (anchorRef) {
          const totalBuses = routeInfo?.weekdayCount || rosterData.length || 1;
          daysArray.forEach(d => {
            const targetDateObj = new Date(year, month - 1, d);
            const shift = getShiftForDate(targetDateObj, bIdx, dIdx, anchorRef, totalBuses);
            if (shift !== null) {
              newSchedules[String(d)] = String(shift);
            }
          });
        }
      }
      newDrivers[dIdx] = {
        ...newDrivers[dIdx],
        name: trimmedName,
        schedules: newSchedules,
        baseSchedules: { ...(newDrivers[dIdx].baseSchedules || newSchedules) },
      };
    }

    newData[bIdx] = { ...newData[bIdx], drivers: newDrivers };
    updateDataAndSave(newData);
    return true;
  };

  const clearDriverSchedules = useCallback(
    (bIdx: number, dIdx: number) => {
      const newData = cloneRoster(rosterData);
      if (!newData[bIdx]?.drivers?.[dIdx]) return;
      newData[bIdx].drivers[dIdx] = {
        ...newData[bIdx].drivers[dIdx],
        schedules: {},
        baseSchedules: {},
      };
      updateDataAndSave(newData);
    },
    [rosterData, updateDataAndSave]
  );

  const updateDriverDefaultRestDays = useCallback(
    (bIdx: number, dIdx: number, restDays: string[], syncPartner: boolean = true) => {
      const newData = cloneRoster(rosterData);
      const group = newData[bIdx];
      if (!group?.drivers?.[dIdx]) return;

      group.drivers[dIdx] = {
        ...group.drivers[dIdx],
        defaultRestDays: restDays,
      };

      const isSp = group.busNo.trim().toUpperCase() === 'SP';
      if (syncPartner && !isSp && group.drivers.length > 1) {
        const partnerIdx = dIdx === 0 ? 1 : 0;
        if (group.drivers[partnerIdx]) {
          group.drivers[partnerIdx] = {
            ...group.drivers[partnerIdx],
            defaultRestDays: restDays,
          };
        }
      }

      updateDataAndSave(newData);
    },
    [rosterData, updateDataAndSave]
  );

  // 기본휴무가 '미지정(-)'인 기사만 안전하게 자동 추출 (이미 지정/수정된 기본휴무는 절대 변경하지 않음)
  const autoExtractAllDefaultRestDays = useCallback(() => {
    if (rosterData.length === 0) return 0;
    const newData = cloneRoster(rosterData);
    const prevDate = new Date(year, month - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = prevDate.getMonth() + 1;

    let updatedCount = 0;

    newData.forEach((group, bIdx) => {
      group.drivers.forEach((drv, dIdx) => {
        const cleanName = drv.name?.trim() || '';
        if (!cleanName) return;

        if (drv.defaultRestDays && drv.defaultRestDays.length === 2) return;

        let inferred: string[] = [];

        if (prevMonthRoster.length > 0) {
          let prevDrv: DriverInfo | null = null;
          for (const pg of prevMonthRoster) {
            for (const pd of pg.drivers) {
              if (pd.name?.trim() === cleanName) {
                prevDrv = pd;
                break;
              }
            }
            if (prevDrv) break;
          }
          if (!prevDrv) {
            prevDrv = prevMonthRoster[bIdx]?.drivers?.[dIdx] || null;
          }
          if (prevDrv) {
            if (prevDrv.defaultRestDays && prevDrv.defaultRestDays.length === 2) {
              inferred = [...prevDrv.defaultRestDays];
            } else {
              const prevSource =
                prevDrv.baseSchedules && Object.keys(prevDrv.baseSchedules).length > 0
                  ? prevDrv.baseSchedules
                  : prevDrv.schedules;
              inferred = inferDefaultRestDaysFromSchedules(prevSource, prevY, prevM);
            }
          }
        }

        if (inferred.length < 2) {
          const currentSource =
            drv.baseSchedules && Object.keys(drv.baseSchedules).length > 0
              ? drv.baseSchedules
              : drv.schedules;
          inferred = inferDefaultRestDaysFromSchedules(currentSource, year, month);
        }

        if (inferred.length === 2) {
          drv.defaultRestDays = inferred;
          updatedCount++;
        }
      });

      if (group.busNo.trim().toUpperCase() !== 'SP' && group.drivers.length === 2) {
        const r0 = group.drivers[0]?.defaultRestDays;
        const r1 = group.drivers[1]?.defaultRestDays;
        if (r0 && r0.length === 2 && (!r1 || r1.length < 2) && group.drivers[1]?.name?.trim()) {
          group.drivers[1].defaultRestDays = [...r0];
          updatedCount++;
        } else if (r1 && r1.length === 2 && (!r0 || r0.length < 2) && group.drivers[0]?.name?.trim()) {
          group.drivers[0].defaultRestDays = [...r1];
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      updateDataAndSave(newData);
    }
    return updatedCount;
  }, [rosterData, prevMonthRoster, year, month, updateDataAndSave]);

  const updateBusNo = (bIdx: number, newBusNo: string) => {
    const trimmedVal = newBusNo.trim();
    if (!trimmedVal) return { success: false, empty: true };

    const isDuplicate = rosterData.some((group, idx) => idx !== bIdx && group.busNo === trimmedVal);
    if (isDuplicate) return { success: false, duplicate: true };

    const newData = cloneRoster(rosterData);
    newData[bIdx] = { ...newData[bIdx], busNo: trimmedVal };
    updateDataAndSave(newData);
    return { success: true };
  };

  const applySchedule = (
    bIdx: number,
    dIdx: number,
    day: number,
    workText: string | null,
    isCustom: boolean = false,
    dayType: string = 'WEEKDAY'
  ) => {
    const isPrivate = routeInfo?.routeType === 'PRIVATE';
    const totalBuses = routeInfo?.weekdayCount || rosterData.length || 1;
    const isShiftNumber =
      !isCustom && workText !== null && isNormalPrivateShift(workText, allRoutes, totalBuses);

    let isEmpty = true;
    for (const group of rosterData) {
      for (const driver of group.drivers) {
        if (Object.keys(driver.schedules).length > 0) {
          isEmpty = false;
          break;
        }
      }
      if (!isEmpty) break;
    }

    if (isPrivate && isEmpty && isShiftNumber && workText !== null) {
      const anchorRef = {
        bIdx,
        dIdx,
        shift: parseInt(workText, 10),
        dateObj: new Date(year, month - 1, day),
      };

      const newData = rosterData.map((group, currentBIdx) => {
        const newDrivers = group.drivers.map((driver, currentDIdx) => {
          if (!driver.name.trim()) return { ...driver, schedules: {}, baseSchedules: {} };

          const newSchedules: Record<string, string> = {};
          daysArray.forEach(d => {
            const targetDateObj = new Date(year, month - 1, d);
            const shift = getShiftForDate(targetDateObj, currentBIdx, currentDIdx, anchorRef, totalBuses);
            if (shift !== null) {
              newSchedules[String(d)] = String(shift);
            }
          });

          return { ...driver, schedules: newSchedules, baseSchedules: { ...newSchedules } };
        });
        return { ...group, drivers: newDrivers };
      });

      updateDataAndSave(newData);
      return;
    }

    const newData = cloneRoster(rosterData);
    const newDrivers = [...newData[bIdx].drivers];
    const newSchedules = { ...newDrivers[dIdx].schedules };

    if (workText === null) {
      delete newSchedules[String(day)];
    } else {
      newSchedules[String(day)] = workText;
    }

    newDrivers[dIdx] = { ...newDrivers[dIdx], schedules: newSchedules };

    const isSpBus = newData[bIdx].busNo.trim().toUpperCase() === 'SP';
    if (!isPrivate && !isSpBus && newDrivers.length >= 2 && workText && !isCustom) {
      const match = workText.trim().match(/^(전|후)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const shiftNum = parseInt(match[2], 10);
        const oppositePrefix = prefix === '전' ? '후' : '전';
        const oppositeWork = `${oppositePrefix}${shiftNum}`;
        const otherDIdx = dIdx === 0 ? 1 : 0;

        const otherDriver = newDrivers[otherDIdx];
        const otherCurrentWork = otherDriver?.schedules?.[String(day)];

        if (otherDriver && otherDriver.name.trim() !== '' && (!otherCurrentWork || otherCurrentWork.trim() === '')) {
          let drops: number[] = [];
          if (dayType === 'SAT') drops = routeInfo?.satDrops || [];
          else if (dayType === 'SUN' || dayType === 'JEOLNAL') drops = routeInfo?.sunDrops || [];
          const isDropped = drops.includes(shiftNum);

          let isTaken = false;
          for (let gIdx = 0; gIdx < newData.length; gIdx++) {
            const groupDrivers = gIdx === bIdx ? newDrivers : newData[gIdx].drivers;
            for (let drvIdx = 0; drvIdx < groupDrivers.length; drvIdx++) {
              if (gIdx === bIdx && (drvIdx === dIdx || drvIdx === otherDIdx)) continue;
              if (groupDrivers[drvIdx].schedules[String(day)] === oppositeWork) {
                isTaken = true;
                break;
              }
            }
            if (isTaken) break;
          }

          if (!isDropped && !isTaken) {
            newDrivers[otherDIdx] = {
              ...otherDriver,
              schedules: {
                ...otherDriver.schedules,
                [String(day)]: oppositeWork,
              },
            };
          }
        }
      }
    }

    newData[bIdx] = { ...newData[bIdx], drivers: newDrivers };
    updateDataAndSave(newData);
  };

  // 민영제 전용: 빈 달력 명단 자동 호출 + 이전 달 순번에 이어 한 달 치 근무 자동 생성
  const runPrivateInitialSetup = useCallback(() => {
    const prevDate = new Date(year, month - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = prevDate.getMonth() + 1;
    const prevDaysCount = new Date(year, month - 1, 0).getDate();

    const sourceRoster =
      rosterData.length > 0
        ? rosterData
        : prevMonthRoster.map(group => ({
            ...group,
            drivers: group.drivers.map(drv => ({
              ...drv,
              schedules: {},
              baseSchedules: {},
            })),
          }));

    if (sourceRoster.length === 0) return false;

    const newData = cloneRoster(sourceRoster);
    const totalBuses = routeInfo?.weekdayCount || newData.length || 1;
    const firstDayDateObj = new Date(year, month - 1, 1);

    const voteCounts: Record<string, number> = {};

    prevMonthRoster.forEach((group, prevBIdx) => {
      const matchedBIdx = newData.findIndex(g => g.busNo.trim() === group.busNo.trim());
      const effectiveBIdx = matchedBIdx >= 0 ? matchedBIdx : prevBIdx;

      group.drivers.forEach((drv, dIdx) => {
        if (!drv.name || !drv.name.trim()) return;
        const effMap = buildPrivateEffectiveScheduleMap(drv, allRoutes, totalBuses);

        for (let day = 1; day <= prevDaysCount; day++) {
          const w = (effMap[String(day)] || '').trim();
          if (!isNormalPrivateShift(w, allRoutes, totalBuses)) continue;

          const shiftNum = parseInt(w, 10);
          if (isNaN(shiftNum)) continue;

          const obsDateObj = new Date(prevY, prevM - 1, day);
          const diffDays = Math.round((firstDayDateObj.getTime() - obsDateObj.getTime()) / 86400000);
          const workingDIdxOnDay1 = (((dIdx + diffDays) % 2) + 2) % 2;

          const projectedShift = getShiftForDate(
            firstDayDateObj,
            0,
            workingDIdxOnDay1,
            { bIdx: effectiveBIdx, dIdx, shift: shiftNum, dateObj: obsDateObj },
            totalBuses
          );

          if (projectedShift !== null) {
            const key = `${workingDIdxOnDay1}:${projectedShift}`;
            const weight = day > 15 ? 2 : 1;
            voteCounts[key] = (voteCounts[key] || 0) + weight;
          }
        }
      });
    });

    let bestDIdx = 0;
    let bestShift = 1;
    let maxVotes = -1;

    Object.entries(voteCounts).forEach(([key, votes]) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        const [dStr, sStr] = key.split(':');
        bestDIdx = Number(dStr);
        bestShift = Number(sStr);
      }
    });

    const anchorRef = {
      bIdx: 0,
      dIdx: bestDIdx,
      shift: bestShift,
      dateObj: firstDayDateObj,
    };

    const filledData = newData.map((group, currentBIdx) => {
      const newDrivers = group.drivers.map((driver, currentDIdx) => {
        if (!driver.name || !driver.name.trim()) {
          return { ...driver, schedules: {}, baseSchedules: {} };
        }

        const newSchedules: Record<string, string> = {};
        daysArray.forEach(d => {
          const targetDateObj = new Date(year, month - 1, d);
          const shift = getShiftForDate(targetDateObj, currentBIdx, currentDIdx, anchorRef, totalBuses);
          if (shift !== null) {
            newSchedules[String(d)] = String(shift);
          }
        });

        return {
          ...driver,
          schedules: newSchedules,
          baseSchedules: { ...newSchedules },
        };
      });

      return { ...group, drivers: newDrivers };
    });

    updateDataAndSave(filledData);
    return true;
  }, [
    rosterData,
    prevMonthRoster,
    routeInfo?.weekdayCount,
    allRoutes,
    daysArray,
    year,
    month,
    getShiftForDate,
    updateDataAndSave,
  ]);

  // ✨ 공공관리제 전용: 매일 순번 순환(휴무일 포함) + 기본휴무 날 빈칸 및 교대(전/후) 전환
  const runPublicInitialSetup = useCallback(() => {
    const prevDate = new Date(year, month - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = prevDate.getMonth() + 1;
    const prevDaysCount = new Date(year, month - 1, 0).getDate();

    const sourceRoster =
      rosterData.length > 0
        ? rosterData
        : prevMonthRoster.map(group => ({
            ...group,
            drivers: group.drivers.map(drv => ({
              ...drv,
              schedules: {},
              baseSchedules: {},
              defaultRestDays: Array.isArray(drv.defaultRestDays) ? [...drv.defaultRestDays] : [],
            })),
          }));

    if (sourceRoster.length === 0) return false;

    const newData = cloneRoster(sourceRoster);

    const findPrevDriver = (driverName: string, busNo: string, bIdx: number, dIdx: number): DriverInfo | null => {
      if (!prevMonthRoster || prevMonthRoster.length === 0) return null;
      const cleanName = driverName.trim();
      if (cleanName) {
        for (const g of prevMonthRoster) {
          for (const d of g.drivers) {
            if (d.name?.trim() === cleanName) return d;
          }
        }
      }
      const sameBus = prevMonthRoster.find(g => g.busNo.trim() === busNo.trim());
      if (sameBus?.drivers?.[dIdx]) return sameBus.drivers[dIdx];
      return prevMonthRoster[bIdx]?.drivers?.[dIdx] || null;
    };

    // 1단계: 기본휴무 미지정 기사가 있을 때만 보완 후 기존 스케줄 초기화 (이미 지정된 기본휴무는 100% 보존)
    newData.forEach((group, bIdx) => {
      group.drivers.forEach((drv, dIdx) => {
        if (drv.name?.trim() && (!drv.defaultRestDays || drv.defaultRestDays.length < 2)) {
          let inferred: string[] = [];
          const prevDrv = findPrevDriver(drv.name, group.busNo, bIdx, dIdx);

          if (prevDrv?.defaultRestDays && prevDrv.defaultRestDays.length === 2) {
            inferred = [...prevDrv.defaultRestDays];
          } else if (prevDrv) {
            const prevSource =
              prevDrv.baseSchedules && Object.keys(prevDrv.baseSchedules).length > 0
                ? prevDrv.baseSchedules
                : prevDrv.schedules;
            inferred = inferDefaultRestDaysFromSchedules(prevSource, prevY, prevM);
          }

          if (inferred.length < 2) {
            const currentSource =
              drv.baseSchedules && Object.keys(drv.baseSchedules).length > 0
                ? drv.baseSchedules
                : drv.schedules;
            inferred = inferDefaultRestDaysFromSchedules(currentSource, year, month);
          }

          if (inferred.length === 2) {
            drv.defaultRestDays = inferred;
          }
        }
        drv.schedules = {};
        drv.baseSchedules = {};
      });

      if (group.busNo.trim().toUpperCase() !== 'SP' && group.drivers.length === 2) {
        const r0 = group.drivers[0]?.defaultRestDays;
        const r1 = group.drivers[1]?.defaultRestDays;
        if (r0 && r0.length === 2 && (!r1 || r1.length < 2) && group.drivers[1]?.name?.trim()) {
          group.drivers[1].defaultRestDays = [...r0];
        } else if (r1 && r1.length === 2 && (!r0 || r0.length < 2) && group.drivers[0]?.name?.trim()) {
          group.drivers[0].defaultRestDays = [...r1];
        }
      }
    });

    // 2단계: 고정차번 구간(SP 이전 그룹: 1~9번 / SP 이후 그룹: 10~15번 등) 분리
    interface FixedZone {
      groupIndices: number[];
      minOrder: number;
      maxOrder: number;
    }
    const zones: FixedZone[] = [];
    let currentZone: FixedZone | null = null;
    let orderCounter = 1;

    newData.forEach((group, bIdx) => {
      const isSp = group.busNo.trim().toUpperCase() === 'SP';
      if (!isSp) {
        if (!currentZone) {
          currentZone = { groupIndices: [bIdx], minOrder: orderCounter, maxOrder: orderCounter };
          zones.push(currentZone);
        } else {
          currentZone.groupIndices.push(bIdx);
          currentZone.maxOrder = orderCounter;
        }
        orderCounter++;
      } else {
        currentZone = null;
      }
    });

    const totalFixedBuses = orderCounter - 1;
    const totalShiftsCount = routeInfo?.weekdayCount || totalFixedBuses || 1;

    // 3단계: 고정차번 차량별 '매일 +1 순환 순번' 및 '기본휴무 경계 교대 전환' 배정
    zones.forEach(zone => {
      const { minOrder, maxOrder } = zone;

      zone.groupIndices.forEach((bIdx, k) => {
        const group = newData[bIdx];
        const defaultOrderNum = minOrder + k;

        const prevDrv0 = findPrevDriver(group.drivers[0]?.name || '', group.busNo, bIdx, 0);
        const prevDrv1 = findPrevDriver(group.drivers[1]?.name || '', group.busNo, bIdx, 1);

        const map0 = buildEffectiveScheduleMap(prevDrv0);
        const map1 = buildEffectiveScheduleMap(prevDrv1);

        // 현월 기본휴무 요일 셋
        const currRestDays =
          group.drivers[0]?.defaultRestDays?.length === 2
            ? group.drivers[0].defaultRestDays
            : group.drivers[1]?.defaultRestDays?.length === 2
            ? group.drivers[1].defaultRestDays
            : [];
        const currRestSet = new Set(currRestDays);
        
        // 전월 기본휴무 요일 셋 파악 (1순위: 전월에 저장된 기본휴무, 2순위: 전월 스케줄에서 추론)
        let prevRestDays: string[] = [];
        if (prevDrv0?.defaultRestDays && prevDrv0.defaultRestDays.length === 2) {
          prevRestDays = prevDrv0.defaultRestDays;
        } else if (prevDrv1?.defaultRestDays && prevDrv1.defaultRestDays.length === 2) {
          prevRestDays = prevDrv1.defaultRestDays;
        } else {
          const inferredPrev0 = inferDefaultRestDaysFromSchedules(
            prevDrv0?.baseSchedules && Object.keys(prevDrv0.baseSchedules).length > 0
              ? prevDrv0.baseSchedules
              : prevDrv0?.schedules,
            prevY,
            prevM
          );
          const inferredPrev1 = inferDefaultRestDaysFromSchedules(
            prevDrv1?.baseSchedules && Object.keys(prevDrv1.baseSchedules).length > 0
              ? prevDrv1.baseSchedules
              : prevDrv1?.schedules,
            prevY,
            prevM
          );
          if (inferredPrev0.length === 2) {
            prevRestDays = inferredPrev0;
          } else if (inferredPrev1.length === 2) {
            prevRestDays = inferredPrev1;
          } else {
            prevRestDays = currRestDays;
          }
        }
        const prevRestSet = new Set(prevRestDays);

        // A. [순번 복원] 순번은 휴무일·주말과 무관하게 매일 +1씩 순환하므로,
        // 전월 정규 근무일(d)의 순번을 현월 1일(prevDaysCount - d + 1일 뒤)로 투영해 다수결로 현월 1일 시작 순번 산출!
        const day1ShiftVotes: Record<number, number> = {};
        for (let d = 1; d <= prevDaysCount; d++) {
          const dow = DOW_NAMES[new Date(prevY, prevM - 1, d).getDay()];
          const isRestDay = prevRestSet.has(dow);
          // 정규 근무일에 높은 가중치 부여 (월 후반부 가중치 추가)
          const weight = (isRestDay ? 1 : 4) * (d > 15 ? 2 : 1);
          const stepsToCurrDay1 = prevDaysCount - d + 1;

          const m0 = (map0[String(d)] || '').trim().match(/^(전|후)(\d+)$/);
          if (m0) {
            const n0 = parseInt(m0[2], 10);
            if (n0 >= minOrder && n0 <= maxOrder) {
              const projectedDay1 = advanceInZone(n0, stepsToCurrDay1, minOrder, maxOrder);
              day1ShiftVotes[projectedDay1] = (day1ShiftVotes[projectedDay1] || 0) + weight;
            }
          }

          const m1 = (map1[String(d)] || '').trim().match(/^(전|후)(\d+)$/);
          if (m1) {
            const n1 = parseInt(m1[2], 10);
            if (n1 >= minOrder && n1 <= maxOrder) {
              const projectedDay1 = advanceInZone(n1, stepsToCurrDay1, minOrder, maxOrder);
              day1ShiftVotes[projectedDay1] = (day1ShiftVotes[projectedDay1] || 0) + weight;
            }
          }
        }

        let day1ShiftNum = defaultOrderNum;
        let maxShiftVotes = -1;
        Object.entries(day1ShiftVotes).forEach(([numStr, votes]) => {
          if (votes > maxShiftVotes) {
            maxShiftVotes = votes;
            day1ShiftNum = Number(numStr);
          }
        });

        // B. [교대(전/후) 복원] 전월 기본휴무를 제외한 정규 근무 블록들에서 마지막 블록의 교대 형태 파악
        const prevBlocks: number[][] = [];
        let tempBlock: number[] = [];
        for (let d = 1; d <= prevDaysCount; d++) {
          const dow = DOW_NAMES[new Date(prevY, prevM - 1, d).getDay()];
          if (prevRestSet.has(dow)) {
            if (tempBlock.length > 0) {
              prevBlocks.push(tempBlock);
              tempBlock = [];
            }
          } else {
            tempBlock.push(d);
          }
        }
        if (tempBlock.length > 0) {
          prevBlocks.push(tempBlock);
        }

        const blockPrefixes: ('전' | '후' | null)[] = prevBlocks.map(bDays => {
          let amVotes = 0;
          let pmVotes = 0;
          bDays.forEach(d => {
            const m0 = (map0[String(d)] || '').trim().match(/^(전|후)(\d+)$/);
            const m1 = (map1[String(d)] || '').trim().match(/^(전|후)(\d+)$/);
            if (m0) {
              if (m0[1] === '전') amVotes++;
              else pmVotes++;
            }
            if (m1) {
              if (m1[1] === '후') amVotes++;
              else pmVotes++;
            }
          });
          if (amVotes === 0 && pmVotes === 0) return null;
          return amVotes >= pmVotes ? '전' : '후';
        });

        for (let i = 1; i < blockPrefixes.length; i++) {
          if (!blockPrefixes[i] && blockPrefixes[i - 1]) {
            blockPrefixes[i] = blockPrefixes[i - 1] === '전' ? '후' : '전';
          }
        }
        for (let i = blockPrefixes.length - 2; i >= 0; i--) {
          if (!blockPrefixes[i] && blockPrefixes[i + 1]) {
            blockPrefixes[i] = blockPrefixes[i + 1] === '전' ? '후' : '전';
          }
        }

        const lastPrevPrefix =
          blockPrefixes.length > 0 ? blockPrefixes[blockPrefixes.length - 1] : null;
        const lastPrevRegularDay =
          prevBlocks.length > 0
            ? prevBlocks[prevBlocks.length - 1][prevBlocks[prevBlocks.length - 1].length - 1]
            : 0;

        const prevLastDayDow = DOW_NAMES[new Date(prevY, prevM - 1, prevDaysCount).getDay()];
        const currFirstDayDow = DOW_NAMES[new Date(year, month - 1, 1).getDay()];

        const isPrevLastDayRest = prevRestSet.has(prevLastDayDow);
        const isCurrFirstDayRest = currRestSet.has(currFirstDayDow);

        // 전월 말일과 현월 1일 사이에 기본휴무가 없으면 전월 마지막 주간과 동일 교대 유지, 기본휴무가 있으면 교대 전환!
        let currFirstBlockDrv0Prefix: '전' | '후';
        if (!lastPrevPrefix) {
          currFirstBlockDrv0Prefix = '전';
        } else if (!isPrevLastDayRest && !isCurrFirstDayRest && lastPrevRegularDay === prevDaysCount) {
          currFirstBlockDrv0Prefix = lastPrevPrefix;
        } else {
          currFirstBlockDrv0Prefix = lastPrevPrefix === '전' ? '후' : '전';
        }

        // C. 현월 1일 ~ 말일까지 번호는 매일 +1 순환하고, 기본휴무 날짜만 빈칸 처리 & 휴무 후 교대(전/후) 전환!
        let blockIndex = -1;
        let inWorkBlock = false;
        const dayShiftNumMap: Record<number, number> = {};
        const dayDrv0PrefixMap: Record<number, '전' | '후'> = {};

        daysArray.forEach(day => {
          // 순번은 휴무일·주말과 무관하게 매일 차례대로 +1 순환
          const shiftNum = advanceInZone(day1ShiftNum, day - 1, minOrder, maxOrder);
          const dow = DOW_NAMES[new Date(year, month - 1, day).getDay()];

          if (currRestSet.has(dow)) {
            // 기본휴무 날짜는 빈칸 처리하고 다음 근무 블록에서 교대가 바뀌도록 플래그 해제
            inWorkBlock = false;
            return;
          }

          if (!inWorkBlock) {
            blockIndex++;
            inWorkBlock = true;
          }

          const drv0Prefix: '전' | '후' =
            blockIndex % 2 === 0
              ? currFirstBlockDrv0Prefix
              : currFirstBlockDrv0Prefix === '전'
              ? '후'
              : '전';

          dayShiftNumMap[day] = shiftNum;
          dayDrv0PrefixMap[day] = drv0Prefix;
        });

        // D. 각 기사별 스케줄 입력 + [전월 말일 오후➔현월 1일 오전 빈칸 처리] & [7일 연속 근로 빈칸 처리]
        group.drivers.forEach((driver, dIdx) => {
          if (!driver.name || !driver.name.trim()) return;

          const myPrev = dIdx === 0 ? prevDrv0 : prevDrv1;
          const myPrevActualSchedules = myPrev?.schedules || {};
          const prevLastDayActualWork = (myPrevActualSchedules[String(prevDaysCount)] || '').trim();

          daysArray.forEach(day => {
            const shiftNum = dayShiftNumMap[day];
            const drv0Prefix = dayDrv0PrefixMap[day];
            if (shiftNum === undefined || !drv0Prefix) return;

            const myPrefix: '전' | '후' =
              dIdx === 0 ? drv0Prefix : drv0Prefix === '전' ? '후' : '전';
            const assignedShift = `${myPrefix}${shiftNum}`;

            // 기본 배차 원본(baseSchedules)에는 원래 순번 기록 보존
            driver.baseSchedules![String(day)] = assignedShift;

            // 예외 1: 전월 마지막 날 실제 근무가 오후('후')인 상태에서 현월 1일 초기세팅이 오전('전')으로 시작하면 첫날 빈칸 처리
            if (day === 1 && prevLastDayActualWork.includes('후') && myPrefix === '전') {
              return;
            }

            // 예외 2: 전월 마지막 주·말일 실제 근무와 이어져 7일 연속 근로에 해당하면 빈칸 처리
            let consecutivePriorDays = 0;
            for (let step = 1; step <= 6; step++) {
              const targetD = day - step;
              let worked = false;
              if (targetD >= 1) {
                worked = isActualPublicWork(driver.schedules[String(targetD)]);
              } else {
                const pDay = prevDaysCount + targetD;
                if (pDay >= 1) {
                  worked = isActualPublicWork(myPrevActualSchedules[String(pDay)]);
                }
              }
              if (worked) consecutivePriorDays++;
              else break;
            }

            if (consecutivePriorDays >= 6) {
              return;
            }

            driver.schedules[String(day)] = assignedShift;
          });
        });
      });
    });

    // 4단계: 날짜별 고정차번 배정 후 남은 순번(전/후) 집계
    const remainingAmByDay: Record<number, string[]> = {};
    const remainingPmByDay: Record<number, string[]> = {};

    daysArray.forEach(day => {
      const usedSet = new Set<string>();
      newData.forEach(group => {
        if (group.busNo.trim().toUpperCase() === 'SP') return;
        group.drivers.forEach(drv => {
          const w = (drv.schedules[String(day)] || '').trim();
          if (w) usedSet.add(w);
        });
      });

      const amList: string[] = [];
      const pmList: string[] = [];
      for (let s = 1; s <= totalShiftsCount; s++) {
        const amShift = `전${s}`;
        const pmShift = `후${s}`;
        if (!usedSet.has(amShift)) amList.push(amShift);
        if (!usedSet.has(pmShift)) pmList.push(pmShift);
      }
      remainingAmByDay[day] = amList;
      remainingPmByDay[day] = pmList;
    });

    // 5단계: SP 기사들 기본휴무 경계 기준 교대 연속성 반영 + 남은 순번 배정 + 7일 연속/역교대 빈칸 처리
    let spIndex = 0;
    newData.forEach((group, bIdx) => {
      if (group.busNo.trim().toUpperCase() !== 'SP') return;

      group.drivers.forEach((driver, dIdx) => {
        if (!driver.name || !driver.name.trim()) return;

        const currRestSet = new Set(driver.defaultRestDays || []);

        const blocks: number[][] = [];
        let currentBlock: number[] = [];

        daysArray.forEach(day => {
          const dow = DOW_NAMES[new Date(year, month - 1, day).getDay()];
          if (currRestSet.has(dow)) {
            if (currentBlock.length > 0) {
              blocks.push(currentBlock);
              currentBlock = [];
            }
          } else {
            currentBlock.push(day);
          }
        });
        if (currentBlock.length > 0) {
          blocks.push(currentBlock);
        }

        const prevSp = findPrevDriver(driver.name, group.busNo, bIdx, dIdx);
        const prevSpMap = buildEffectiveScheduleMap(prevSp);
        const prevSpActual = prevSp?.schedules || {};

        // 전월 SP 기사의 기본휴무 파악 (1순위: 전월에 저장된 기본휴무, 2순위: 전월 스케줄 추론, 3순위: 현월 기본휴무)
        let prevSpRestDays: string[] = [];
        if (prevSp?.defaultRestDays && prevSp.defaultRestDays.length === 2) {
          prevSpRestDays = prevSp.defaultRestDays;
        } else {
          const inferredSpPrevRest = inferDefaultRestDaysFromSchedules(
            prevSp?.baseSchedules && Object.keys(prevSp.baseSchedules).length > 0
              ? prevSp.baseSchedules
              : prevSp?.schedules,
            prevY,
            prevM
          );
          prevSpRestDays =
            inferredSpPrevRest.length === 2
              ? inferredSpPrevRest
              : driver.defaultRestDays || [];
        }
        const prevSpRestSet = new Set(prevSpRestDays);

        const prevSpBlocks: number[][] = [];
        let tempSpBlk: number[] = [];
        for (let d = 1; d <= prevDaysCount; d++) {
          const dow = DOW_NAMES[new Date(prevY, prevM - 1, d).getDay()];
          if (prevSpRestSet.has(dow)) {
            if (tempSpBlk.length > 0) {
              prevSpBlocks.push(tempSpBlk);
              tempSpBlk = [];
            }
          } else {
            tempSpBlk.push(d);
          }
        }
        if (tempSpBlk.length > 0) {
          prevSpBlocks.push(tempSpBlk);
        }

        let spLastRegularType: '전' | '후' | null = null;
        let spLastRegularDay = 0;
        for (let bi = prevSpBlocks.length - 1; bi >= 0; bi--) {
          const bDays = prevSpBlocks[bi];
          let amV = 0;
          let pmV = 0;
          bDays.forEach(d => {
            const w = (prevSpMap[String(d)] || '').trim();
            if (w.includes('전')) amV++;
            else if (w.includes('후')) pmV++;
          });
          if (amV > 0 || pmV > 0) {
            spLastRegularType = amV >= pmV ? '전' : '후';
            spLastRegularDay = bDays[bDays.length - 1];
            break;
          }
        }

        const isPrevLastRest = prevSpRestSet.has(
          DOW_NAMES[new Date(prevY, prevM - 1, prevDaysCount).getDay()]
        );
        const isCurrFirstRest = currRestSet.has(DOW_NAMES[new Date(year, month - 1, 1).getDay()]);

        let blockTargetType: '전' | '후';
        if (!spLastRegularType) {
          blockTargetType = spIndex % 2 === 0 ? '전' : '후';
        } else if (!isPrevLastRest && !isCurrFirstRest && spLastRegularDay === prevDaysCount) {
          blockTargetType = spLastRegularType;
        } else {
          blockTargetType = spLastRegularType === '전' ? '후' : '전';
        }

        blocks.forEach((blockDays, bIdxInSp) => {
          if (blockDays.length === 0) return;

          if (bIdxInSp > 0) {
            blockTargetType = blockTargetType === '전' ? '후' : '전';
          }

          blockDays.forEach(day => {
            let consecutivePrior = 0;
            for (let step = 1; step <= 6; step++) {
              const targetD = day - step;
              let worked = false;
              if (targetD >= 1) {
                worked = isActualPublicWork(driver.schedules[String(targetD)]);
              } else {
                const pDay = prevDaysCount + targetD;
                if (pDay >= 1) {
                  worked = isActualPublicWork(prevSpActual[String(pDay)]);
                }
              }
              if (worked) consecutivePrior++;
              else break;
            }
            if (consecutivePrior >= 6) return;

            const prevDayWork =
              day > 1
                ? (driver.schedules[String(day - 1)] || '').trim()
                : (prevSpActual[String(prevDaysCount)] || '').trim();

            let assigned = '';
            if (blockTargetType === '전') {
              if (!prevDayWork.includes('후') && remainingAmByDay[day].length > 0) {
                assigned = remainingAmByDay[day].shift()!;
              } else if (prevDayWork.includes('전') && remainingPmByDay[day].length > 0) {
                assigned = remainingPmByDay[day].shift()!;
              }
            } else {
              if (remainingPmByDay[day].length > 0) {
                assigned = remainingPmByDay[day].shift()!;
              }
            }

            if (assigned) {
              driver.schedules[String(day)] = assigned;
              driver.baseSchedules![String(day)] = assigned;
            }
          });
        });

        spIndex++;
      });
    });

    updateDataAndSave(newData);
    return true;
  }, [rosterData, prevMonthRoster, routeInfo?.weekdayCount, daysArray, year, month, updateDataAndSave]);

  const assignSubstitute = useCallback(
    (
      day: number,
      targetBIdx: number,
      targetDIdx: number,
      subBIdx: number,
      subDIdx: number,
      targetLeaveType: '연차' | '신청휴무' | ''
    ) => {
      const newData = cloneRoster(rosterData);
      const targetDriver = newData[targetBIdx]?.drivers?.[targetDIdx];
      const subDriver = newData[subBIdx]?.drivers?.[subDIdx];
      if (!targetDriver || !subDriver) return false;

      const workToTransfer = targetDriver.schedules[String(day)];
      if (!workToTransfer) return false;

      subDriver.schedules[String(day)] = workToTransfer;
      if (targetLeaveType === '') {
        delete targetDriver.schedules[String(day)];
      } else {
        targetDriver.schedules[String(day)] = targetLeaveType;
      }

      updateDataAndSave(newData);
      return true;
    },
    [rosterData, updateDataAndSave]
  );

  const swapSchedule = useCallback(
    (day: number, bIdx1: number, dIdx1: number, bIdx2: number, dIdx2: number, targetWork: string) => {
      const newData = cloneRoster(rosterData);
      const drv1 = newData[bIdx1]?.drivers?.[dIdx1];
      const drv2 = newData[bIdx2]?.drivers?.[dIdx2];
      if (!drv1 || !drv2) return false;

      const prevWork1 = drv1.schedules[String(day)] || '';
      drv1.schedules[String(day)] = targetWork;

      if (prevWork1) {
        drv2.schedules[String(day)] = prevWork1;
      } else {
        delete drv2.schedules[String(day)];
      }

      updateDataAndSave(newData);
      return true;
    },
    [rosterData, updateDataAndSave]
  );

  const resetAllSchedules = () => {
    const newData = rosterData.map(group => ({
      ...group,
      drivers: group.drivers.map(driver => ({
        ...driver,
        schedules: {},
        baseSchedules: {},
      })),
    }));
    updateDataAndSave(newData);
  };

  const clearAllData = () => {
    updateDataAndSave([]);
  };

  return {
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
    canUndo: pastHistory.length > 0,
    canRedo: futureHistory.length > 0,
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
    updateDataAndSave,
  };
}