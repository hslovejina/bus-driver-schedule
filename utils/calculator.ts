// 파일 위치: utils/calculator.ts

export type DriverInfo = {
  id?: string;
  name: string;
  schedules: Record<string, string>;
  baseSchedules?: Record<string, string>;
  defaultRestDays?: string[];
};

export interface RowStatsResult {
  totalWorkDays: number;
  amCount: number;
  pmCount: number;
  targetSojeong: number;
  fixedRestsStr: string;
  jeolnalTotal: number;
  bokgyeokCount: number;
  overtimeDays: number;
  extraTotal: number;
  expectedSalary: number;
}

export interface PrivatePayRow {
  basic: number;
  ot: number;
  night: number;
  juhyu: number;
  extra: number;
}

export type PrivatePayTableMap = Record<string, PrivatePayRow>;

export interface PublicWageRule {
  startYearMonth: string; // 예: '2026-06'
  hourlyWage: number;
}

export interface PrivateWageRule {
  startYearMonth: string; // 예: '2026-06'
  jeolHourlyWage: number; // 민영 절근로 시급 (기본 17201)
  safeBonus: number;      // 무사고 수당 (기본 60000)
  payTable: PrivatePayTableMap;
}

export interface SystemPayConfig {
  publicRules?: PublicWageRule[];
  privateRules?: PrivateWageRule[];
}

export const DEFAULT_PLACEHOLDER_NAMES = ['새 기사', '오전 기사', '오후 기사', 'A조 기사', 'B조 기사'];

// 민영제 기본 조견표 (0.5일 ~ 16일)
export const DEFAULT_PRIVATE_PAY_TABLE: Record<number, PrivatePayRow> = {
  0.5: { basic: 99830, ot: 38060, night: 14800, juhyu: 0, extra: 0 },
  1: { basic: 199640, ot: 76130, night: 29610, juhyu: 0, extra: 0 },
  1.5: { basic: 299460, ot: 114200, night: 44410, juhyu: 0, extra: 0 },
  2: { basic: 399290, ot: 152260, night: 59210, juhyu: 0, extra: 0 },
  2.5: { basic: 499100, ot: 190330, night: 74020, juhyu: 0, extra: 0 },
  3: { basic: 591020, ot: 225390, night: 87650, juhyu: 145090, extra: 0 },
  3.5: { basic: 690670, ot: 263390, night: 102420, juhyu: 145320, extra: 0 },
  4: { basic: 790360, ot: 301410, night: 117210, juhyu: 145520, extra: 0 },
  4.5: { basic: 884670, ot: 345250, night: 131820, juhyu: 145460, extra: 0 },
  5: { basic: 968160, ot: 400610, night: 146060, juhyu: 145050, extra: 0 },
  5.5: { basic: 1057050, ot: 450160, night: 160470, juhyu: 144890, extra: 0 },
  6: { basic: 1139580, ot: 496920, night: 173920, juhyu: 287870, extra: 0 },
  6.5: { basic: 1228500, ot: 546380, night: 188340, juhyu: 287760, extra: 0 },
  7: { basic: 1317440, ot: 595820, night: 202750, juhyu: 287660, extra: 0 },
  7.5: { basic: 1411650, ot: 639580, night: 217340, juhyu: 287800, extra: 0 },
  8: { basic: 1516450, ot: 671950, night: 232280, juhyu: 288360, extra: 0 },
  8.5: { basic: 1616000, ot: 710020, night: 247060, juhyu: 288650, extra: 0 },
  9: { basic: 1709360, ot: 745370, night: 260880, juhyu: 431810, extra: 0 },
  9.5: { basic: 1808840, ot: 783390, night: 275640, juhyu: 432230, extra: 0 },
  10: { basic: 1908360, ot: 821420, night: 290400, juhyu: 432610, extra: 0 },
  10.5: { basic: 2007880, ot: 859460, night: 305170, juhyu: 432970, extra: 0 },
  11: { basic: 2107450, ot: 897500, night: 319940, juhyu: 433280, extra: 0 },
  11.5: { basic: 2201700, ot: 941270, night: 334540, juhyu: 433360, extra: 0 },
  12: { basic: 2338150, ot: 1019540, night: 356840, juhyu: 590660, extra: 0 },
  12.5: { basic: 2429380, ot: 1070285, night: 371630, juhyu: 590535, extra: 0 },
  13: { basic: 2520610, ot: 1121030, night: 386420, juhyu: 590410, extra: 0 },
  13.5: { basic: 2576135, ot: 1155620, night: 395710, juhyu: 582505, extra: 39675 },
  14: { basic: 2631660, ot: 1190210, night: 405000, juhyu: 574600, extra: 79350 },
  14.5: { basic: 2724250, ot: 1233230, night: 419340, juhyu: 574430, extra: 118980 },
  15: { basic: 2827320, ot: 1264850, night: 434020, juhyu: 574720, extra: 158730 },
  15.5: { basic: 2925140, ot: 1302180, night: 448530, juhyu: 574780, extra: 198430 },
  16: { basic: 3022980, ot: 1339510, night: 463040, juhyu: 574830, extra: 238130 },
};

// 런타임 급여 설정 캐시 (배차 탭 / 통계 탭 / 엑셀 내보내기 공통 참조)
let runtimePayConfig: SystemPayConfig | null = null;

export function setRuntimePayConfig(config: SystemPayConfig | null | undefined) {
  runtimePayConfig = config || null;
}

export function getPrivateRuleForYearMonth(yearMonth: string): {
  jeolHourlyWage: number;
  safeBonus: number;
  payTable: Record<string, PrivatePayRow>;
} {
  const defaultTableStrKey: Record<string, PrivatePayRow> = {};
  Object.entries(DEFAULT_PRIVATE_PAY_TABLE).forEach(([k, v]) => {
    defaultTableStrKey[String(k)] = v;
  });

  const rules = runtimePayConfig?.privateRules;
  if (!rules || rules.length === 0) {
    return {
      jeolHourlyWage: 17201,
      safeBonus: 60000,
      payTable: defaultTableStrKey,
    };
  }

  // 시작월 오름차순 정렬 후 해당 yearMonth 이하인 가장 최신 규칙 선택
  const sorted = [...rules].sort((a, b) => a.startYearMonth.localeCompare(b.startYearMonth));
  let matched = sorted[0];
  for (const r of sorted) {
    if (r.startYearMonth <= yearMonth) {
      matched = r;
    }
  }

  if (yearMonth < sorted[0].startYearMonth) {
    return {
      jeolHourlyWage: 17201,
      safeBonus: 60000,
      payTable: defaultTableStrKey,
    };
  }

  return {
    jeolHourlyWage: matched.jeolHourlyWage || 17201,
    safeBonus: matched.safeBonus ?? 60000,
    payTable: matched.payTable || defaultTableStrKey,
  };
}

export function getDayType(
  year: number,
  month: number,
  day: number,
  holidays: Record<string, string> = {}
): 'JEOLNAL' | 'SUN' | 'SAT' | 'WEEKDAY' {
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (holidays[dateStr]) return 'JEOLNAL';
  const dow = new Date(year, month - 1, day).getDay();
  if (dow === 0) return 'SUN';
  if (dow === 6) return 'SAT';
  return 'WEEKDAY';
}

export function findMatchedSupportRoute(
  work: string,
  allRoutes: { name: string; routeType: string }[] = []
): { name: string; routeType: string } | null {
  if (!work || !allRoutes || allRoutes.length === 0) return null;
  const trimmed = work.trim();
  if (!trimmed) return null;

  const cleanName = trimmed.replace(/(지원|번|\s)+$/g, '').trim();
  const found = allRoutes.find(r => r.name === trimmed || (cleanName && r.name === cleanName));
  return found || null;
}

export function isNormalPrivateShift(
  work: string,
  allRoutes: { name: string; routeType: string }[] = [],
  maxShift: number = 50
): boolean {
  if (!work || !/^\d+$/.test(work.trim())) return false;
  if (findMatchedSupportRoute(work, allRoutes)) return false;
  const num = Number(work.trim());
  return num >= 1 && num <= maxShift;
}

export function isPrivateWorkDay(
  work: string,
  allRoutes: { name: string; routeType: string }[] = [],
  _maxShift: number = 50
): boolean {
  if (!work) return false;
  const trimmed = work.trim();
  if (!trimmed) return false;

  if (['신청휴무', '휴무', 'x', 'X', '-', '연차', '연', '조퇴'].includes(trimmed)) {
    return false;
  }
  if (trimmed === '근무') return true;

  const matchedRoute = findMatchedSupportRoute(trimmed, allRoutes);
  if (matchedRoute) {
    return matchedRoute.routeType === 'PRIVATE';
  }

  return true;
}

export function calculatePayrollStats(
  workSchedule: Record<string, string>,
  year: number,
  month: number,
  hourlyWage: number = 16911,
  holidays: Record<string, string> = {},
  routeType: string = 'PUBLIC',
  prevMonthLastDayWork: string = ''
) {
  const ceil10 = (val: number) => Math.ceil(val / 10) * 10;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const targetYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;

  let hasAnyWork = false;
  for (let i = 1; i <= daysInMonth; i++) {
    const dateKey = `${targetYearMonth}-${String(i).padStart(2, '0')}`;
    const work = workSchedule[dateKey];
    if (work && work !== 'x' && work.trim() !== '') {
      hasAnyWork = true;
      break;
    }
  }

  if (!hasAnyWork) {
    return {
      targetSojeong: 0,
      jeolnalTotal: 0,
      holidayTotal: 0,
      fixedRestDays: [] as number[],
      totalWorkDays: 0,
      bokgyeokCount: 0,
      grossPay: 0,
    };
  }

  if (routeType === 'PRIVATE') {
    const privateRule = getPrivateRuleForYearMonth(targetYearMonth);

    let normalWorkDays = 0;
    let earlyLeaveDays = 0;
    let annualLeave = 0;
    let bokgyeokCount = 0;
    let holidayWorkedCount = 0;
    let holidayRestedCount = 0;

    for (let i = 1; i <= daysInMonth; i++) {
      const dateKey = `${targetYearMonth}-${String(i).padStart(2, '0')}`;
      const work = workSchedule[dateKey] || '';
      const isJeolnal = !!(holidays && holidays[dateKey]);

      if (work === '근무') {
        normalWorkDays += 1;
        if (i === 1) {
          if (prevMonthLastDayWork === '근무') bokgyeokCount += 1;
        } else {
          const prevDateKey = `${targetYearMonth}-${String(i - 1).padStart(2, '0')}`;
          if (workSchedule[prevDateKey] === '근무') bokgyeokCount += 1;
        }
      } else if (work === '조퇴') {
        earlyLeaveDays += 1;
      } else if (work === '연차' || work === '연') {
        annualLeave += 1;
      }

      if (isJeolnal) {
        if (work === '근무' || work === '조퇴') {
          holidayWorkedCount += 1;
        } else {
          holidayRestedCount += 1;
        }
      }
    }

    const totalWorkDays = normalWorkDays + earlyLeaveDays * 0.5;
    const daysWorkedForTable = totalWorkDays + annualLeave;
    let safeDays = daysWorkedForTable > 16 ? 16 : daysWorkedForTable < 0.5 ? 0 : daysWorkedForTable;
    safeDays = Math.round(safeDays * 2) / 2;

    const tableData =
      privateRule.payTable[String(safeDays)] ||
      DEFAULT_PRIVATE_PAY_TABLE[safeDays] || { basic: 0, ot: 0, night: 0, juhyu: 0, extra: 0 };

    const holidayHours = holidayWorkedCount * 18.7 + holidayRestedCount * 8;
    const jeolnalPay = ceil10(holidayHours * privateRule.jeolHourlyWage);
    const safeDrivingBonus = totalWorkDays > 0 ? privateRule.safeBonus : 0;

    const grossPay =
      tableData.basic +
      tableData.ot +
      tableData.night +
      jeolnalPay +
      tableData.juhyu +
      tableData.extra +
      safeDrivingBonus;

    return {
      targetSojeong: 12,
      jeolnalTotal: holidayWorkedCount,
      holidayTotal: 0,
      fixedRestDays: [] as number[],
      totalWorkDays,
      bokgyeokCount,
      grossPay,
    };
  }

  // 공공관리제 (PUBLIC) 주차별 계산
  const restCounts = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    const dateKey = `${targetYearMonth}-${String(i).padStart(2, '0')}`;
    const w = workSchedule[dateKey];
    if (!w || w === 'x' || w === '휴무' || w === '신청휴무') {
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

  const fixedRestDays: number[] =
    restCounts[prevDay] >= restCounts[nextDay] ? [prevDay, maxRestDay] : [maxRestDay, nextDay];

  const juhyuWeekday =
    restCounts[fixedRestDays[0]] < restCounts[fixedRestDays[1]] ? fixedRestDays[0] : fixedRestDays[1];

  let expectedJuhyuWeeks = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    if (new Date(year, month, i).getDay() === juhyuWeekday) expectedJuhyuWeeks++;
  }

  const monthWeeks: any[] = [];
  let currentWeek: any[] = [];

  let sojeongAmOriginal = 0;
  let sojeongPmOriginal = 0;
  let jeolnalAm = 0;
  let jeolnalPm = 0;
  let restJeolnal = 0;
  let targetSojeong = 0;
  let annualLeave = 0;

  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    const dateKey = `${targetYearMonth}-${String(i).padStart(2, '0')}`;
    const dayOfWeek = d.getDay();

    const isJeolnal = !!(holidays && holidays[dateKey]);
    const isFixedRest = fixedRestDays.includes(dayOfWeek);
    const work = workSchedule[dateKey] || '';

    currentWeek.push({ dateKey, dayOfWeek, work, isJeolnal, isFixedRest });

    if (dayOfWeek === 6 || i === daysInMonth) {
      monthWeeks.push(currentWeek);
      currentWeek = [];
    }

    if (!isFixedRest && !isJeolnal) {
      targetSojeong++;
    }

    if (isJeolnal) {
      if (work === '오전') jeolnalAm++;
      else if (work === '오후') jeolnalPm++;
      else restJeolnal++;
    } else if (!isFixedRest) {
      if (work === '오전') sojeongAmOriginal++;
      else if (work === '오후') sojeongPmOriginal++;
      else if (work === '연차' || work === '연') annualLeave++;
    }
  }

  let juhyuMissingWeeks = 0;
  const internalConversions: any[] = [];
  const externalJuhyuConversions: any[] = [];
  const pool: any[] = [];
  const deficitWeeks: number[] = [];

  for (const week of monthWeeks) {
    const isFullWeek = week.length === 7;
    let regularDaysInWeek = 0;
    const holidayExtInWeek: any[] = [];

    for (const d of week) {
      if (d.isJeolnal) {
        if (!d.isFixedRest) regularDaysInWeek++;
      } else if (d.isFixedRest) {
        if (d.work === '오전' || d.work === '오후') holidayExtInWeek.push({ ...d, isFullWeek });
      } else {
        if (d.work === '연차' || d.work === '연' || d.work === '오전' || d.work === '오후') {
          regularDaysInWeek++;
        }
      }
    }

    if (isFullWeek && regularDaysInWeek < 5) {
      let deficit = 5 - regularDaysInWeek;
      while (deficit > 0 && holidayExtInWeek.length > 0) {
        internalConversions.push(holidayExtInWeek.shift());
        deficit--;
      }
      if (deficit > 0) {
        deficitWeeks.push(deficit);
      }
    }
    pool.push(...holidayExtInWeek);
  }

  for (const deficit of deficitWeeks) {
    if (pool.length >= deficit) {
      for (let i = 0; i < deficit; i++) {
        externalJuhyuConversions.push(pool.shift());
      }
    } else {
      juhyuMissingWeeks++;
    }
  }

  const juhyuWeeks = Math.max(0, expectedJuhyuWeeks - juhyuMissingWeeks);

  const currentSojeong =
    sojeongAmOriginal +
    sojeongPmOriginal +
    annualLeave +
    internalConversions.length +
    externalJuhyuConversions.length;
  let globalDeficit = targetSojeong - currentSojeong;
  const targetFillerConversions: any[] = [];

  if (globalDeficit > 0) {
    pool.sort((a, b) => (a.isFullWeek ? 1 : 0) - (b.isFullWeek ? 1 : 0));
    while (globalDeficit > 0 && pool.length > 0) {
      targetFillerConversions.push(pool.shift());
      globalDeficit--;
    }
  }

  const allConversions = [...internalConversions, ...externalJuhyuConversions, ...targetFillerConversions];
  let ddaempangAm = 0;
  let ddaempangPm = 0;
  for (const d of allConversions) {
    if (d.work === '오전') ddaempangAm++;
    else if (d.work === '오후') ddaempangPm++;
  }

  const sojeongAm = sojeongAmOriginal + ddaempangAm;
  const sojeongPm = sojeongPmOriginal + ddaempangPm;
  const sojeongTotal = sojeongAm + sojeongPm + annualLeave;

  const holidayAm = pool.filter(d => d.work === '오전').length;
  const holidayPm = pool.filter(d => d.work === '오후').length;
  const holidayTotal = holidayAm + holidayPm;

  const jeolnalTotal = jeolnalAm + jeolnalPm;
  const totalWorkDays = sojeongTotal + jeolnalTotal + holidayTotal;

  const basePay = ceil10(22 * 8 * hourlyWage);
  const overtimePay = ceil10(sojeongTotal * 1.5 * hourlyWage);
  const nightPay = ceil10(sojeongAm * 1.0 * hourlyWage) + ceil10(sojeongPm * 1.5 * hourlyWage);
  const jeolnalPay =
    ceil10(23 * hourlyWage) * jeolnalAm +
    ceil10(23.5 * hourlyWage) * jeolnalPm +
    ceil10(8 * hourlyWage) * restJeolnal;
  const holidayOvertimePay = ceil10(15 * hourlyWage) * holidayAm + ceil10(15.5 * hourlyWage) * holidayPm;
  const juhyuPay = ceil10(8 * hourlyWage) * juhyuWeeks;
  const safeDrivingBonus = totalWorkDays > 0 ? 60000 : 0;

  let extraPay = 0;
  if (sojeongTotal > targetSojeong) {
    const extraDays = sojeongTotal - targetSojeong;
    extraPay = ceil10(extraDays * 15.5 * hourlyWage);
  }

  const grossPay =
    basePay + overtimePay + nightPay + jeolnalPay + holidayOvertimePay + juhyuPay + safeDrivingBonus + extraPay;

  return {
    targetSojeong,
    jeolnalTotal,
    holidayTotal,
    fixedRestDays,
    totalWorkDays,
    bokgyeokCount: 0,
    grossPay,
  };
}

export function calculateRowStats(
  driver: DriverInfo,
  year: number,
  month: number,
  daysArray: number[],
  holidays: Record<string, string>,
  hourlyWage: number,
  routeType: string = 'PUBLIC',
  prevMonthLastDayWork: string = '',
  allRoutes: { name: string; routeType: string }[] = [],
  maxShift: number = 50
): RowStatsResult {
  let amCount = 0;
  let pmCount = 0;

  const normalizedSchedule: Record<string, string> = {};

  daysArray.forEach(day => {
    const rawWork = driver.schedules[String(day)] || '';
    const work = rawWork.trim();
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (!work || ['신청휴무', '휴무', 'x', 'X', '-'].includes(work)) {
      normalizedSchedule[dateKey] = '';
      return;
    }

    if (work === '연' || work === '연차') {
      normalizedSchedule[dateKey] = '연차';
      return;
    }
    if (work === '조퇴') {
      normalizedSchedule[dateKey] = '조퇴';
      return;
    }

    const matchedSupportRoute = findMatchedSupportRoute(work, allRoutes);
    if (matchedSupportRoute) {
      if (matchedSupportRoute.routeType === routeType) {
        if (routeType === 'PRIVATE') {
          amCount++;
          normalizedSchedule[dateKey] = '근무';
        } else {
          amCount++;
          normalizedSchedule[dateKey] = '오전';
        }
      } else {
        normalizedSchedule[dateKey] = '';
      }
      return;
    }

    if (routeType === 'PRIVATE') {
      amCount++;
      normalizedSchedule[dateKey] = '근무';
    } else {
      if (work.includes('후') || work.includes('오후')) {
        pmCount++;
        normalizedSchedule[dateKey] = '오후';
      } else {
        amCount++;
        normalizedSchedule[dateKey] = '오전';
      }
    }
  });

  const normalizedPrevWork =
    routeType === 'PRIVATE' && isPrivateWorkDay(prevMonthLastDayWork, allRoutes, maxShift)
      ? '근무'
      : prevMonthLastDayWork;

  const targetYm = `${year}-${String(month).padStart(2, '0')}`;
  const appliedWage =
    routeType === 'PRIVATE'
      ? getPrivateRuleForYearMonth(targetYm).jeolHourlyWage
      : hourlyWage;

  const stats = calculatePayrollStats(
    normalizedSchedule,
    year,
    month - 1,
    appliedWage,
    holidays,
    routeType,
    normalizedPrevWork
  );

  return {
    totalWorkDays: stats.totalWorkDays || 0,
    amCount,
    pmCount,
    targetSojeong: stats.targetSojeong || 0,
    fixedRestsStr:
      stats.fixedRestDays && stats.fixedRestDays.length > 0
        ? stats.fixedRestDays.map((d: number) => ['일', '월', '화', '수', '목', '금', '토'][d]).join('')
        : '-',
    jeolnalTotal: stats.jeolnalTotal || 0,
    bokgyeokCount: stats.bokgyeokCount || 0,
    overtimeDays: stats.holidayTotal || 0,
    extraTotal: (stats.jeolnalTotal || 0) + (stats.holidayTotal || 0),
    expectedSalary: stats.grossPay || 0,
  };
}