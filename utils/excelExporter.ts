// 파일 위치: utils/excelExporter.ts
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { calculateRowStats, type DriverInfo } from './calculator';
import type { BusGroup } from '../hooks/useRosterData';

const DOW_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF94A3B8' } },
  left: { style: 'thin', color: { argb: 'FF94A3B8' } },
  bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
  right: { style: 'thin', color: { argb: 'FF94A3B8' } },
};

function applyBoxBorder(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  style: ExcelJS.BorderStyle = 'medium',
  colorArgb: string = 'FF334155'
) {
  const borderEdge: Partial<ExcelJS.Border> = { style, color: { argb: colorArgb } };

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = sheet.getCell(r, c);
      const current = cell.border || {};
      cell.border = {
        top: r === startRow ? borderEdge : current.top,
        bottom: r === endRow ? borderEdge : current.bottom,
        left: c === startCol ? borderEdge : current.left,
        right: c === endCol ? borderEdge : current.right,
      };
    }
  }
}

// ============================================================================
// 1. 민영제 배차표 엑셀 내보내기
// ============================================================================
export async function exportPrivateRosterExcel(params: {
  year: number;
  month: number;
  route: string;
  daysArray: number[];
  holidays: Record<string, string>;
  processedRoster: any[];
  prevMonthRoster: BusGroup[];
  dailyStats: Record<number, { am: number; pm: number; total: number }>;
  hourlyWage: number;
  routeInfo: any;
  allRoutes: { name: string; routeType: string }[];
  maxDriverOrder: number;
}) {
  const {
    year, month, route, daysArray, holidays, processedRoster,
    prevMonthRoster, dailyStats, hourlyWage, routeInfo, allRoutes, maxDriverOrder
  } = params;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${month}월 근무계획표`, {
    views: [{ showGridLines: true }]
  });

  const daysCount = daysArray.length;
  const maxShiftCount = routeInfo?.weekdayCount || maxDriverOrder || 50;

  const colSum = 2 + daysCount + 1;      // 합계 열
  const colGap = colSum + 1;             // 빈 열 (간격)
  const colBokgyeok = colGap + 1;        // 복격 열

  const getDayType = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = new Date(year, month - 1, day).getDay();
    if (holidays[dateStr]) return 'JEOLNAL';
    if (dow === 0) return 'SUN';
    if (dow === 6) return 'SAT';
    return 'WEEKDAY';
  };

  // 열 너비 설정
  sheet.getColumn(1).width = 9;
  sheet.getColumn(2).width = 12;
  for (let i = 1; i <= daysCount; i++) {
    sheet.getColumn(2 + i).width = 4.5;
  }
  sheet.getColumn(colSum).width = 7.5;
  sheet.getColumn(colGap).width = 2.5;
  sheet.getColumn(colBokgyeok).width = 7.5;

  // 1행: 메인 타이틀
  sheet.mergeCells(1, 1, 1, colSum);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `${year}년  ${month}월  근무계획표  ${route}`;
  titleCell.font = { name: '맑은 고딕', size: 20, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 36;

  // 2행: 날짜 범위 표시
  const mm = String(month).padStart(2, '0');
  const dd = String(daysCount).padStart(2, '0');
  sheet.mergeCells(2, 1, 2, 6);
  const rangeCell = sheet.getCell(2, 1);
  rangeCell.value = `${year}/${mm}/01 - ${mm}/${dd}`;
  rangeCell.font = { name: '맑은 고딕', size: 11 };
  rangeCell.alignment = { horizontal: 'left', vertical: 'middle' };
  sheet.getRow(2).height = 20;

  // 3~4행: 테이블 헤더
  sheet.getRow(3).height = 19;
  sheet.getRow(4).height = 19;

  sheet.mergeCells(3, 1, 4, 1);
  sheet.getCell(3, 1).value = '차번';
  sheet.mergeCells(3, 2, 4, 2);
  sheet.getCell(3, 2).value = '성명';

  daysArray.forEach((day, idx) => {
    const c = 3 + idx;
    const dow = DOW_NAMES[new Date(year, month - 1, day).getDay()];
    const dayType = getDayType(day);

    const cTop = sheet.getCell(3, c);
    const cBot = sheet.getCell(4, c);
    cTop.value = day;
    cBot.value = dow;

    let fillArgb = 'FFFFFFFF';
    if (dayType === 'JEOLNAL') fillArgb = 'FFFCE4D6';
    else if (dayType === 'SUN') fillArgb = 'FFD9D9D9';

    [cTop, cBot].forEach(cell => {
      cell.font = { name: '맑은 고딕', size: 10, bold: false };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
      cell.border = thinBorder;
    });
  });

  sheet.mergeCells(3, colSum, 4, colSum);
  sheet.getCell(3, colSum).value = '합 계';

  sheet.mergeCells(3, colBokgyeok, 4, colBokgyeok);
  sheet.getCell(3, colBokgyeok).value = '복격';

  [1, 2, colSum, colBokgyeok].forEach(c => {
    for (let r = 3; r <= 4; r++) {
      const cell = sheet.getCell(r, c);
      cell.font = { name: '맑은 고딕', size: 10.5, bold: false };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    }
  });

  let currentRow = 5;
  let totalWorkSum = 0;
  let totalBokgyeokSum = 0;
  let teamAEndRow = 4;
  let teamBEndRow = 4;

  for (const dIdx of [0, 1]) {
    processedRoster.forEach((busGroup, bIdx) => {
      const driver: DriverInfo | undefined = busGroup.drivers[dIdx];
      if (!driver) return;

      const row = sheet.getRow(currentRow);
      row.height = 22;

      const alignHoriz: 'left' | 'right' = dIdx === 0 ? 'left' : 'right';
      const isFirstInTeam = bIdx === 0;
      const isLastInTeam = bIdx === processedRoster.length - 1;

      const topStyle: ExcelJS.BorderStyle = isFirstInTeam ? 'medium' : 'dotted';
      const topColor = isFirstInTeam ? 'FF000000' : 'FF94A3B8';
      const botStyle: ExcelJS.BorderStyle = isLastInTeam ? 'medium' : 'dotted';
      const botColor = isLastInTeam ? 'FF000000' : 'FF94A3B8';

      const rowBorder: Partial<ExcelJS.Borders> = {
        top: { style: topStyle, color: { argb: topColor } },
        bottom: { style: botStyle, color: { argb: botColor } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };

      let prevMonthLastDayWork = '';
      if (prevMonthRoster[bIdx] && prevMonthRoster[bIdx].drivers[dIdx]) {
        const prevDays = new Date(year, month - 1, 0).getDate();
        prevMonthLastDayWork = prevMonthRoster[bIdx].drivers[dIdx].schedules[String(prevDays)] || '';
      }

      const rowStats = calculateRowStats(
        driver, year, month, daysArray, holidays, hourlyWage,
        'PRIVATE', prevMonthLastDayWork, allRoutes, maxShiftCount
      );

      totalWorkSum += rowStats.totalWorkDays;
      totalBokgyeokSum += rowStats.bokgyeokCount;

      const cBus = sheet.getCell(currentRow, 1);
      cBus.value = /^\d+$/.test(busGroup.busNo) ? Number(busGroup.busNo) : busGroup.busNo;
      cBus.font = { name: '맑은 고딕', size: 11, bold: true };
      cBus.alignment = { horizontal: alignHoriz, vertical: 'middle' };
      cBus.border = rowBorder;

      const cName = sheet.getCell(currentRow, 2);
      cName.value = driver.name || '';
      cName.font = { name: '맑은 고딕', size: 11, bold: true };
      cName.alignment = { horizontal: alignHoriz, vertical: 'middle' };
      cName.border = rowBorder;

      daysArray.forEach((day, idx) => {
        const c = 3 + idx;
        const cell = sheet.getCell(currentRow, c);
        const rawWork = driver.schedules[String(day)] || '';
        const dayType = getDayType(day);

        let displayVal: string | number = '';
        let isBold = false;

        if (rawWork === '신청휴무') {
          displayVal = 'X';
        } else if (rawWork) {
          displayVal = /^\d+$/.test(rawWork) ? Number(rawWork) : rawWork;
          const baseWork = driver.baseSchedules?.[String(day)];
          const isDefault = baseWork !== undefined && baseWork === rawWork;
          isBold = !isDefault;
        }

        cell.value = displayVal;
        cell.font = { name: '맑은 고딕', size: 11, bold: isBold };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

        if (dayType === 'JEOLNAL') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
        } else if (dayType === 'SUN') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        }

        cell.border = rowBorder;
      });

      const cSum = sheet.getCell(currentRow, colSum);
      cSum.value = rowStats.totalWorkDays;
      cSum.font = { name: '맑은 고딕', size: 11, bold: false };
      cSum.alignment = { horizontal: alignHoriz, vertical: 'middle' };
      cSum.border = rowBorder;

      const cBok = sheet.getCell(currentRow, colBokgyeok);
      cBok.value = driver.name.trim() ? rowStats.bokgyeokCount : '';
      cBok.font = { name: '맑은 고딕', size: 11, bold: false };
      cBok.alignment = { horizontal: 'center', vertical: 'middle' };
      cBok.border = rowBorder;

      if (dIdx === 0) teamAEndRow = currentRow;
      else teamBEndRow = currentRow;

      currentRow++;
    });
  }

  // 하단 합계 행
  const sumRowIdx = currentRow;
  const sumRow = sheet.getRow(sumRowIdx);
  sumRow.height = 24;
  sheet.mergeCells(sumRowIdx, 1, sumRowIdx, 2);
  const sumLabelCell = sheet.getCell(sumRowIdx, 1);
  sumLabelCell.value = '합   계';
  sumLabelCell.font = { name: '맑은 고딕', size: 11, bold: false };
  sumLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell(sumRowIdx, 1).border = thinBorder;
  sheet.getCell(sumRowIdx, 2).border = thinBorder;

  daysArray.forEach((day, idx) => {
    const c = 3 + idx;
    const cell = sheet.getCell(sumRowIdx, c);
    const dayType = getDayType(day);
    cell.value = dailyStats[day]?.total || 0;
    cell.font = { name: '맑은 고딕', size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };

    if (dayType === 'JEOLNAL') {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
    } else if (dayType === 'SUN') {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    }
    cell.border = thinBorder;
  });

  const cTotalSum = sheet.getCell(sumRowIdx, colSum);
  cTotalSum.value = totalWorkSum;
  cTotalSum.font = { name: '맑은 고딕', size: 11 };
  cTotalSum.alignment = { horizontal: 'center', vertical: 'middle' };
  cTotalSum.border = thinBorder;

  const cTotalBok = sheet.getCell(sumRowIdx, colBokgyeok);
  cTotalBok.value = totalBokgyeokSum;
  cTotalBok.font = { name: '맑은 고딕', size: 11 };
  cTotalBok.alignment = { horizontal: 'center', vertical: 'middle' };
  cTotalBok.border = thinBorder;

  // 외곽 및 구역 굵은 테두리(medium) 마감
  applyBoxBorder(sheet, 3, 1, 4, colSum, 'medium', 'FF000000');
  if (teamAEndRow >= 5) {
    applyBoxBorder(sheet, 5, 1, teamAEndRow, colSum, 'medium', 'FF000000');
  }
  if (teamBEndRow > teamAEndRow) {
    applyBoxBorder(sheet, teamAEndRow + 1, 1, teamBEndRow, colSum, 'medium', 'FF000000');
  }
  applyBoxBorder(sheet, sumRowIdx, 1, sumRowIdx, colSum, 'medium', 'FF000000');

  // ✨ 성명열(2열)과 첫날짜열(3열) 사이, 끝날짜열과 합계열 사이를 테두리처럼 굵은선(medium)으로 마감
  for (let r = 3; r <= sumRowIdx; r++) {
    // 2열(성명) 우측 ➔ 3열(1일) 좌측이 굵은선
    sheet.getCell(r, 2).border = { ...sheet.getCell(r, 2).border, right: { style: 'medium', color: { argb: 'FF000000' } } };
    sheet.getCell(r, 3).border = { ...sheet.getCell(r, 3).border, left: { style: 'medium', color: { argb: 'FF000000' } } };

    // 마지막 날짜열 우측 ➔ 합계열 좌측이 굵은선
    sheet.getCell(r, colSum - 1).border = { ...sheet.getCell(r, colSum - 1).border, right: { style: 'medium', color: { argb: 'FF000000' } } };
    sheet.getCell(r, colSum).border = { ...sheet.getCell(r, colSum).border, left: { style: 'medium', color: { argb: 'FF000000' } } };
  }

  for (let c = 1; c <= colSum; c++) {
    sheet.getCell(4, c).border = { ...sheet.getCell(4, c).border, bottom: { style: 'medium', color: { argb: 'FF000000' } } };
    sheet.getCell(5, c).border = { ...sheet.getCell(5, c).border, top: { style: 'medium', color: { argb: 'FF000000' } } };
    sheet.getCell(sumRowIdx - 1, c).border = { ...sheet.getCell(sumRowIdx - 1, c).border, bottom: { style: 'medium', color: { argb: 'FF000000' } } };
    sheet.getCell(sumRowIdx, c).border = { ...sheet.getCell(sumRowIdx, c).border, top: { style: 'medium', color: { argb: 'FF000000' } } };
  }

  // 복격 열 단독 박스 테두리 처리
  applyBoxBorder(sheet, 3, colBokgyeok, 4, colBokgyeok, 'medium', 'FF000000');
  if (teamAEndRow >= 5) {
    applyBoxBorder(sheet, 5, colBokgyeok, teamAEndRow, colBokgyeok, 'medium', 'FF000000');
  }
  if (teamBEndRow > teamAEndRow) {
    applyBoxBorder(sheet, teamAEndRow + 1, colBokgyeok, teamBEndRow, colBokgyeok, 'medium', 'FF000000');
  }
  applyBoxBorder(sheet, sumRowIdx, colBokgyeok, sumRowIdx, colBokgyeok, 'medium', 'FF000000');
  
  for (let r = 3; r <= sumRowIdx; r++) {
    const cell = sheet.getCell(r, colBokgyeok);
    if (r === 4) cell.border = { ...cell.border, bottom: { style: 'medium', color: { argb: 'FF000000' } } };
    if (r === 5) cell.border = { ...cell.border, top: { style: 'medium', color: { argb: 'FF000000' } } };
    if (r === sumRowIdx - 1) cell.border = { ...cell.border, bottom: { style: 'medium', color: { argb: 'FF000000' } } };
    if (r === sumRowIdx) cell.border = { ...cell.border, top: { style: 'medium', color: { argb: 'FF000000' } } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${year}년_${month}월_근무계획표_${route}.xlsx`);
}

// ============================================================================
// 2. 공공관리제 배차표 엑셀 내보내기
// ============================================================================
export async function exportPublicRosterExcel(params: {
  year: number;
  month: number;
  route: string;
  daysArray: number[];
  holidays: Record<string, string>;
  processedRoster: any[];
  dailyStats: Record<number, { am: number; pm: number; total: number }>;
  hourlyWage: number;
  routeInfo: any;
  allRoutes: { name: string; routeType: string }[];
  maxDriverOrder: number;
  sortedLongShifts: string[];
}) {
  const {
    year, month, route, daysArray, holidays, processedRoster,
    dailyStats, hourlyWage, routeInfo, allRoutes, maxDriverOrder, sortedLongShifts
  } = params;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${String(month).padStart(2, '0')}월`, {
    views: [{ showGridLines: true }]
  });

  const daysCount = daysArray.length;
  const maxShiftCount = routeInfo?.weekdayCount || maxDriverOrder || 50;
  const hasLongShifts = sortedLongShifts.length > 0;

  const colLeftOrder = 1;
  const colBus = 2;
  const colName = 3;
  const colOrder = 35;
  const colSum = 36;
  const colAm = 37;
  const colPm = 38;
  const colName2 = 39;
  const colSojeong = 40;
  const colFixedRest = 41;
  const colJeol = 42;
  const colOt = 43;
  const colExtra = 44;
  const colLongStart = 45;
  const colLongTotal = colLongStart + sortedLongShifts.length;
  const lastTableCol = hasLongShifts ? colLongTotal : colExtra;

  const getDayType = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = new Date(year, month - 1, day).getDay();
    if (holidays[dateStr]) return 'JEOLNAL';
    if (dow === 0) return 'SUN';
    if (dow === 6) return 'SAT';
    return 'WEEKDAY';
  };

  sheet.getColumn(colLeftOrder).width = 4.2;
  sheet.getColumn(colBus).width = 6.5;
  sheet.getColumn(colName).width = 8.5;
  for (let d = 1; d <= 31; d++) {
    sheet.getColumn(3 + d).width = 4.8;
  }
  sheet.getColumn(colOrder).width = 4.2;
  sheet.getColumn(colSum).width = 5.5;
  sheet.getColumn(colAm).width = 4.8;
  sheet.getColumn(colPm).width = 4.8;
  sheet.getColumn(colName2).width = 8.5;
  sheet.getColumn(colSojeong).width = 5.5;
  sheet.getColumn(colFixedRest).width = 5.5;
  sheet.getColumn(colJeol).width = 5.5;
  sheet.getColumn(colOt).width = 5.5;
  sheet.getColumn(colExtra).width = 5.5;
  sortedLongShifts.forEach((_, idx) => {
    sheet.getColumn(colLongStart + idx).width = 4.8;
  });
  if (hasLongShifts) {
    sheet.getColumn(colLongTotal).width = 5.5;
  }

  sheet.getRow(1).height = 28;
  sheet.mergeCells(1, 1, 1, 14);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `${route}번  ${year}년  ${month}월 근무계획표 (2교대)`;
  titleCell.font = { name: '맑은 고딕', size: 16, bold: true };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const satDropsStr = (routeInfo?.satDrops || []).join(',');
  const sunDropsStr = (routeInfo?.sunDrops || []).join(',');

  sheet.mergeCells(1, 15, 1, 20);
  const satCell = sheet.getCell(1, 15);
  satCell.value = `토요일: ${satDropsStr}`;
  satCell.font = { name: '맑은 고딕', size: 11, bold: true };
  satCell.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorder(sheet, 1, 15, 1, 20, 'thin', 'FF94A3B8');

  sheet.mergeCells(1, 21, 1, 29);
  const sunCell = sheet.getCell(1, 21);
  sunCell.value = `일요일 : ${sunDropsStr}`;
  sunCell.font = { name: '맑은 고딕', size: 11, bold: true };
  sunCell.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBoxBorder(sheet, 1, 21, 1, 29, 'thin', 'FF94A3B8');

  sheet.getRow(2).height = 19;
  sheet.mergeCells(2, 1, 2, 6);
  sheet.getCell(2, 1).value = `${month}/01 - ${month}/${daysCount}`;
  sheet.getCell(2, 1).font = { name: '맑은 고딕', size: 10.5, bold: true };

  sheet.mergeCells(2, 23, 2, 27);
  sheet.getCell(2, 23).value = `${year}-${String(month).padStart(2, '0')}-01`;
  sheet.getCell(2, 23).font = { name: '맑은 고딕', size: 10.5, bold: true };
  sheet.getCell(2, 23).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.getRow(4).height = 19;
  sheet.getRow(5).height = 19;

  sheet.mergeCells(4, colLeftOrder, 5, colLeftOrder);
  sheet.getCell(4, colLeftOrder).value = '순서';
  sheet.mergeCells(4, colBus, 5, colBus);
  sheet.getCell(4, colBus).value = '차번';
  sheet.mergeCells(4, colName, 5, colName);
  sheet.getCell(4, colName).value = '성명';

  [colLeftOrder, colBus, colName].forEach(c => {
    [4, 5].forEach(r => {
      const cell = sheet.getCell(r, c);
      cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c === colLeftOrder ? 'FFCBD5E1' : 'FFE2E8F0' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });
  });

  for (let d = 1; d <= 31; d++) {
    const c = 3 + d;
    const cTop = sheet.getCell(4, c);
    const cBot = sheet.getCell(5, c);

    let bgArgb = 'FFFFFFFF';
    let fontColor = 'FF1E293B';

    if (d <= daysCount) {
      const dow = DOW_NAMES[new Date(year, month - 1, d).getDay()];
      const dayType = getDayType(d);
      cTop.value = d;
      cBot.value = dow;

      if (dayType === 'JEOLNAL') {
        bgArgb = 'FFFEE2E2';
        fontColor = 'FFDC2626';
      } else if (dayType === 'SUN') {
        bgArgb = 'FFE2E8F0';
        fontColor = 'FFDC2626';
      } else if (dayType === 'SAT') {
        bgArgb = 'FFF1F5F9';
        fontColor = 'FF2563EB';
      }
    } else {
      bgArgb = 'FFF8FAFC';
    }

    [cTop, cBot].forEach(cell => {
      cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: fontColor } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });
  }

  const rightHeaders: { col: number; label: string; bg: string; fg: string }[] = [
    { col: colOrder, label: '순서', bg: 'FFCBD5E1', fg: 'FF1E293B' },
    { col: colSum, label: '총\n근로', bg: 'FFE2E8F0', fg: 'FF1E293B' },
    { col: colAm, label: '오\n전', bg: 'FFFFF7ED', fg: 'FFC2410C' },
    { col: colPm, label: '오\n후', bg: 'FFEFF6FF', fg: 'FF1D4ED8' },
    { col: colName2, label: '성명', bg: 'FFE2E8F0', fg: 'FF1E293B' },
    { col: colSojeong, label: '소정\n근로', bg: 'FFD1FAE5', fg: 'FF064E3B' },
    { col: colFixedRest, label: '고정\n휴무', bg: 'FFECFDF5', fg: 'FF065F46' },
    { col: colJeol, label: '절\n근로', bg: 'FFFFF1F2', fg: 'FFBE123C' },
    { col: colOt, label: '연장\n근로', bg: 'FFFFF7ED', fg: 'FFC2410C' },
    { col: colExtra, label: '추가\n합계', bg: 'FFFEE2E2', fg: 'FF991B1B' },
  ];

  rightHeaders.forEach(h => {
    sheet.mergeCells(4, h.col, 5, h.col);
    [4, 5].forEach(r => {
      const cell = sheet.getCell(r, h.col);
      if (r === 4) cell.value = h.label;
      cell.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: h.fg } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: h.bg } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    });
  });

  if (hasLongShifts) {
    sheet.mergeCells(4, colLongStart, 4, colLongTotal);
    for (let c = colLongStart; c <= colLongTotal; c++) {
      const topC = sheet.getCell(4, c);
      if (c === colLongStart) topC.value = '긴근무 순번';
      topC.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF451A03' } };
      topC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      topC.alignment = { horizontal: 'center', vertical: 'middle' };
      topC.border = thinBorder;
    }

    sortedLongShifts.forEach((shift, idx) => {
      const c = colLongStart + idx;
      const botC = sheet.getCell(5, c);
      botC.value = shift;
      botC.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF92400E' } };
      botC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
      botC.alignment = { horizontal: 'center', vertical: 'middle' };
      botC.border = thinBorder;
    });

    const totCell = sheet.getCell(5, colLongTotal);
    totCell.value = '합계';
    totCell.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF451A03' } };
    totCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
    totCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totCell.border = thinBorder;
  }

  let currentRow = 6;
  const dataStartRow = 6;
  let spRunningCount = 0;
  let spOrderFilled = false;
  const longShiftColTotals = new Array(sortedLongShifts.length).fill(0);
  let grandLongShiftTotal = 0;

  processedRoster.forEach((busGroup, bIdx) => {
    const isSp = busGroup.busNo.trim().toUpperCase() === 'SP';
    const drivers: DriverInfo[] = busGroup.drivers;
    const startRow = currentRow;

    drivers.forEach((driver, dIdx) => {
      const row = sheet.getRow(currentRow);
      row.height = 19;

      let alignHoriz: 'left' | 'right' = dIdx % 2 === 0 ? 'left' : 'right';
      let isGroupTop = dIdx === 0;
      let isGroupBottom = dIdx === drivers.length - 1;

      if (isSp && drivers.length === 1) {
        const isFirstOfSpPair = spRunningCount % 2 === 0;
        alignHoriz = isFirstOfSpPair ? 'left' : 'right';
        const nextGroup = processedRoster[bIdx + 1];
        const nextIsSp = nextGroup && nextGroup.busNo.trim().toUpperCase() === 'SP' && nextGroup.drivers.length === 1;
        isGroupTop = isFirstOfSpPair;
        isGroupBottom = !(isFirstOfSpPair && nextIsSp);
        spRunningCount++;
      } else {
        spRunningCount = 0;
      }

      const bTopStyle: ExcelJS.BorderStyle = isGroupTop ? 'medium' : 'dotted';
      const bTopColor = isGroupTop ? 'FF334155' : 'FF94A3B8';
      const bBotStyle: ExcelJS.BorderStyle = isGroupBottom ? 'medium' : 'dotted';
      const bBotColor = isGroupBottom ? 'FF334155' : 'FF94A3B8';

      const makeCellBorder = (): Partial<ExcelJS.Borders> => ({
        top: { style: bTopStyle, color: { argb: bTopColor } },
        bottom: { style: bBotStyle, color: { argb: bBotColor } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      });

      const rowStats = calculateRowStats(
        driver, year, month, daysArray, holidays, hourlyWage,
        'PUBLIC', '', allRoutes, maxShiftCount
      );

      const cName = sheet.getCell(currentRow, colName);
      cName.value = driver.name || '';
      cName.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cName.alignment = { horizontal: alignHoriz, vertical: 'middle' };
      cName.border = makeCellBorder();

      for (let d = 1; d <= 31; d++) {
        const c = 3 + d;
        const cell = sheet.getCell(currentRow, c);
        const work = d <= daysCount ? (driver.schedules[String(d)] || '').trim() : '';
        const dayType = d <= daysCount ? getDayType(d) : 'WEEKDAY';

        let defaultBgArgb = 'FFFFFFFF';
        if (d > daysCount) defaultBgArgb = 'FFF8FAFC';
        else if (dayType === 'JEOLNAL') defaultBgArgb = 'FFFEF2F2';
        else if (dayType === 'SUN') defaultBgArgb = 'FFF1F5F9';
        else if (dayType === 'SAT') defaultBgArgb = 'FFF8FAFC';

        if (!work) {
          cell.value = '';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBgArgb } };
        } else if (work === '신청휴무' || work === 'x' || work === 'X') {
          cell.value = 'X';
          cell.font = { name: '맑은 고딕', size: 10.5, bold: true, color: { argb: 'FF64748B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBgArgb } };
        } else if (work.includes('전')) {
          cell.value = work;
          cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } };
        } else if (work.includes('후')) {
          cell.value = work;
          cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
        } else if (work === '연차' || work === '연') {
          cell.value = work;
          cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC084FC' } };
        } else {
          cell.value = work;
          cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
        }

        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = makeCellBorder();
      }

      const hasName = !!driver.name.trim();
      const cSum = sheet.getCell(currentRow, colSum);
      cSum.value = hasName ? rowStats.totalWorkDays : 0;
      cSum.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cSum.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

      const cAm = sheet.getCell(currentRow, colAm);
      cAm.value = hasName ? (rowStats.amCount || 0) : 0;
      cAm.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFC2410C' } };
      cAm.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };

      const cPm = sheet.getCell(currentRow, colPm);
      cPm.value = hasName ? (rowStats.pmCount || 0) : 0;
      cPm.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
      cPm.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

      const cName2 = sheet.getCell(currentRow, colName2);
      cName2.value = driver.name || '';
      cName2.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cName2.alignment = { horizontal: alignHoriz, vertical: 'middle' };

      const cSojeong = sheet.getCell(currentRow, colSojeong);
      cSojeong.value = hasName ? rowStats.targetSojeong : '';
      cSojeong.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF064E3B' } };
      cSojeong.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };

      const cFixed = sheet.getCell(currentRow, colFixedRest);
      cFixed.value = hasName ? rowStats.fixedRestsStr : '';
      cFixed.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF065F46' } };
      cFixed.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };

      const cJeol = sheet.getCell(currentRow, colJeol);
      cJeol.value = hasName && rowStats.jeolnalTotal > 0 ? rowStats.jeolnalTotal : '';
      cJeol.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFE11D48' } };
      cJeol.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };

      const cOt = sheet.getCell(currentRow, colOt);
      cOt.value = hasName && rowStats.overtimeDays > 0 ? rowStats.overtimeDays : '';
      cOt.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFEA580C' } };
      cOt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };

      const cExtra = sheet.getCell(currentRow, colExtra);
      cExtra.value = hasName && rowStats.extraTotal > 0 ? rowStats.extraTotal : '';
      cExtra.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
      cExtra.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };

      [colSum, colAm, colPm, colSojeong, colFixedRest, colJeol, colOt, colExtra].forEach(c => {
        const cell = sheet.getCell(currentRow, c);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = makeCellBorder();
      });
      cName2.border = makeCellBorder();

      if (hasLongShifts) {
        let rowLongSum = 0;
        sortedLongShifts.forEach((shift, sIdx) => {
          let cnt = 0;
          daysArray.forEach(d => {
            if (driver.schedules[String(d)] === shift) cnt++;
          });
          rowLongSum += cnt;
          longShiftColTotals[sIdx] += cnt;

          const lCell = sheet.getCell(currentRow, colLongStart + sIdx);
          lCell.value = cnt;
          lCell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFB45309' } };
          lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
          lCell.alignment = { horizontal: 'center', vertical: 'middle' };
          lCell.border = makeCellBorder();
        });

        grandLongShiftTotal += rowLongSum;
        const totLCell = sheet.getCell(currentRow, colLongTotal);
        totLCell.value = rowLongSum;
        totLCell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF451A03' } };
        totLCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
        totLCell.alignment = { horizontal: 'center', vertical: 'middle' };
        totLCell.border = makeCellBorder();
      }

      currentRow++;
    });

    if (!isSp && drivers.length === 2) {
      sheet.mergeCells(startRow, colLeftOrder, currentRow - 1, colLeftOrder);
      const leftOrdC = sheet.getCell(startRow, colLeftOrder);
      leftOrdC.value = busGroup.displayNo || '';
      leftOrdC.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF334155' } };
      leftOrdC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      leftOrdC.alignment = { horizontal: 'center', vertical: 'middle' };

      sheet.mergeCells(startRow, colBus, currentRow - 1, colBus);
      const busC = sheet.getCell(startRow, colBus);
      busC.value = /^\d+$/.test(busGroup.busNo) ? Number(busGroup.busNo) : busGroup.busNo;
      busC.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF334155' } };
      busC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      busC.alignment = { horizontal: 'center', vertical: 'middle' };

      sheet.mergeCells(startRow, colOrder, currentRow - 1, colOrder);
      const ordC = sheet.getCell(startRow, colOrder);
      ordC.value = busGroup.displayNo || '';
      ordC.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF334155' } };
      ordC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      ordC.alignment = { horizontal: 'center', vertical: 'middle' };

      const f1 = sheet.getCell(startRow, colFixedRest).value;
      const f2 = sheet.getCell(currentRow - 1, colFixedRest).value;
      if (f1 && f1 === f2) {
        sheet.mergeCells(startRow, colFixedRest, currentRow - 1, colFixedRest);
      }

      applyBoxBorder(sheet, startRow, colLeftOrder, currentRow - 1, colLeftOrder, 'thin', 'FF94A3B8');
      applyBoxBorder(sheet, startRow, colBus, currentRow - 1, colBus, 'thin', 'FF94A3B8');
      applyBoxBorder(sheet, startRow, colOrder, currentRow - 1, colOrder, 'thin', 'FF94A3B8');
      for (let c = colLeftOrder; c <= lastTableCol; c++) {
        const topCell = sheet.getCell(startRow, c);
        topCell.border = { ...topCell.border, top: { style: 'medium', color: { argb: 'FF334155' } } };
        const botCell = sheet.getCell(currentRow - 1, c);
        botCell.border = { ...botCell.border, bottom: { style: 'medium', color: { argb: 'FF334155' } } };
      }
    } else {
      const nextGroup = processedRoster[bIdx + 1];
      const nextIsSp = nextGroup && nextGroup.busNo.trim().toUpperCase() === 'SP';
      const isPairTop = spRunningCount % 2 === 1;
      const isPairBottom = spRunningCount % 2 === 0 || !nextIsSp;

      const tStyle: ExcelJS.BorderStyle = isPairTop ? 'medium' : 'dotted';
      const tColor = isPairTop ? 'FF334155' : 'FF94A3B8';
      const bStyle: ExcelJS.BorderStyle = isPairBottom ? 'medium' : 'dotted';
      const bColor = isPairBottom ? 'FF334155' : 'FF94A3B8';

      sheet.getCell(startRow, colBus).value = isSp ? 'SP' : busGroup.busNo;

      if (!nextIsSp && !spOrderFilled) {
        sheet.getCell(startRow, colLeftOrder).value = '';
        sheet.getCell(startRow, colOrder).value = 10;
        spOrderFilled = true;
      }
      [colLeftOrder, colBus, colOrder].forEach(c => {
        const cell = sheet.getCell(startRow, c);
        cell.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF334155' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c === colBus ? 'FFF8FAFC' : 'FFF1F5F9' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: tStyle, color: { argb: tColor } },
          bottom: { style: bStyle, color: { argb: bColor } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } },
        };
      });
    }
  });

  const dataEndRow = currentRow - 1;

  const summaryStartRow = currentRow;
  const summaryLabels = [
    { label: '오전', key: 'am' as const },
    { label: '오후', key: 'pm' as const },
    { label: '계', key: 'total' as const },
  ];

  if (hasLongShifts) {
    sortedLongShifts.forEach((_, sIdx) => {
      const c = sheet.getCell(summaryStartRow, colLongStart + sIdx);
      c.value = longShiftColTotals[sIdx];
      c.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF92400E' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = thinBorder;
    });
    const totC = sheet.getCell(summaryStartRow, colLongTotal);
    totC.value = grandLongShiftTotal;
    totC.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF451A03' } };
    totC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
    totC.alignment = { horizontal: 'center', vertical: 'middle' };
    totC.border = thinBorder;
    applyBoxBorder(sheet, summaryStartRow, colLongStart, summaryStartRow, colLongTotal, 'medium', 'FF334155');
  }

  summaryLabels.forEach((item, sIdx) => {
    const r = summaryStartRow + sIdx;
    sheet.getRow(r).height = 20;
    sheet.mergeCells(r, colLeftOrder, r, colName);
    const lblCell = sheet.getCell(r, colLeftOrder);
    lblCell.value = item.label;
    lblCell.font = {
      name: '맑은 고딕',
      size: 10.5,
      bold: true,
      color: { argb: sIdx === 0 ? 'FFEA580C' : sIdx === 1 ? 'FF2563EB' : 'FF1E293B' }
    };
    lblCell.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = colLeftOrder; c <= colName; c++) {
      sheet.getCell(r, c).border = thinBorder;
    }

    for (let d = 1; d <= 31; d++) {
      const c = 3 + d;
      const cell = sheet.getCell(r, c);
      const val = d <= daysCount ? (dailyStats[d]?.[item.key] || 0) : 0;
      const dayType = d <= daysCount ? getDayType(d) : 'WEEKDAY';

      cell.value = val;
      let fontColor = 'FF1E293B';
      if (d <= daysCount) {
        if (dayType === 'JEOLNAL' || dayType === 'SUN') fontColor = 'FFDC2626';
        else if (dayType === 'SAT') fontColor = 'FF2563EB';
      }

      cell.font = { name: '맑은 고딕', size: 10.5, bold: true, color: { argb: fontColor } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    }
  });

  const summaryEndRow = summaryStartRow + 2;

  applyBoxBorder(sheet, 4, colLeftOrder, 5, lastTableCol, 'medium', 'FF334155');
  if (dataEndRow >= dataStartRow) {
    applyBoxBorder(sheet, dataStartRow, colLeftOrder, dataEndRow, lastTableCol, 'medium', 'FF334155');
    applyBoxBorder(sheet, 4, colLeftOrder, dataEndRow, colName, 'medium', 'FF334155');
    applyBoxBorder(sheet, 4, 4, dataEndRow, 34, 'medium', 'FF334155');
    applyBoxBorder(sheet, 4, colOrder, dataEndRow, colOrder, 'medium', 'FF334155');
    applyBoxBorder(sheet, 4, colSum, dataEndRow, colPm, 'medium', 'FF334155');
    applyBoxBorder(sheet, 4, colName2, dataEndRow, colFixedRest, 'medium', 'FF334155');
    applyBoxBorder(sheet, 4, colJeol, dataEndRow, colExtra, 'medium', 'FF334155');
    if (hasLongShifts) {
      applyBoxBorder(sheet, 4, colLongStart, dataEndRow, colLongTotal, 'medium', 'FF334155');
    }
  }
  applyBoxBorder(sheet, summaryStartRow, colLeftOrder, summaryEndRow, 34, 'medium', 'FF334155');
  applyBoxBorder(sheet, summaryStartRow, colLeftOrder, summaryEndRow, colName, 'medium', 'FF334155');

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${route}노선_${year}년_${month}월_근무계획표.xlsx`);
}

// ============================================================================
// 3. 연간 통계 탭 엑셀 내보내기
// ============================================================================
export async function exportStatisticsExcel(params: {
  year: number;
  route: string;
  isPrivate: boolean;
  fullYearDrivers: any[];
  partialYearDrivers: any[];
}) {
  const { year, route, isPrivate, fullYearDrivers, partialYearDrivers } = params;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${year}년 근무 통계`, {
    views: [{ showGridLines: true }]
  });

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const totalCols = isPrivate ? 3 + 4 + 12 * 3 : 2 + 6 + 12 * 6;
  const leftMetaEndCol = isPrivate ? 3 : 2;
  const sumStartCol = leftMetaEndCol + 1;
  const sumEndCol = isPrivate ? 7 : 8;
  const monthWidth = isPrivate ? 3 : 6;

  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `${route}노선 ${year}년 근무 통계`;
  titleCell.font = { name: '맑은 고딕', size: 18, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 34;

  sheet.getRow(2).height = 20;
  sheet.getRow(3).height = 20;

  if (isPrivate) {
    sheet.getColumn(1).width = 5.5;
    sheet.getColumn(2).width = 7.5;
    sheet.getColumn(3).width = 10;

    sheet.mergeCells(2, 1, 3, 1);
    sheet.getCell(2, 1).value = '팀';
    sheet.mergeCells(2, 2, 3, 2);
    sheet.getCell(2, 2).value = '차번';
    sheet.mergeCells(2, 3, 3, 3);
    sheet.getCell(2, 3).value = '성명';

    sheet.mergeCells(2, 4, 2, 7);
    sheet.getCell(2, 4).value = '합계';
    const sumHeaders = ['근무', '절', '복격', '지원'];
    sumHeaders.forEach((h, i) => {
      sheet.getColumn(4 + i).width = 6;
      sheet.getCell(3, 4 + i).value = h;
    });

    months.forEach((m, idx) => {
      const startCol = 8 + idx * 3;
      sheet.mergeCells(2, startCol, 2, startCol + 2);
      sheet.getCell(2, startCol).value = `${m}월`;
      ['근무', '절', '복격'].forEach((sub, sIdx) => {
        sheet.getColumn(startCol + sIdx).width = 5.2;
        sheet.getCell(3, startCol + sIdx).value = sub;
      });
    });
  } else {
    sheet.getColumn(1).width = 7.5;
    sheet.getColumn(2).width = 10;

    sheet.mergeCells(2, 1, 3, 1);
    sheet.getCell(2, 1).value = '차번';
    sheet.mergeCells(2, 2, 3, 2);
    sheet.getCell(2, 2).value = '성명';

    sheet.mergeCells(2, 3, 2, 8);
    sheet.getCell(2, 3).value = '합계';
    const sumHeaders = ['근무', '소정', '절', '연장', '추가합', '긴근무'];
    sumHeaders.forEach((h, i) => {
      sheet.getColumn(3 + i).width = 6.2;
      sheet.getCell(3, 3 + i).value = h;
    });

    months.forEach((m, idx) => {
      const startCol = 9 + idx * 6;
      sheet.mergeCells(2, startCol, 2, startCol + 5);
      sheet.getCell(2, startCol).value = `${m}월`;
      ['근무', '소정', '절', '연장', '추가합', '긴근무'].forEach((sub, sIdx) => {
        sheet.getColumn(startCol + sIdx).width = 5.5;
        sheet.getCell(3, startCol + sIdx).value = sub;
      });
    });
  }

  for (let r = 2; r <= 3; r++) {
    for (let c = 1; c <= totalCols; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = { name: '맑은 고딕', size: 10, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      const isSumCol = c >= sumStartCol && c <= sumEndCol;
      const isLeftCol = c <= leftMetaEndCol;

      if (isLeftCol) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isPrivate ? 'FFDDEBF7' : 'FFE2E8F0' } };
      } else if (isSumCol) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      } else if (r === 2) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }

      cell.border = thinBorder;
    }
  }

  let currentRow = 4;

  const writeDriverList = (list: any[]) => {
    list.forEach((drv, idx) => {
      const row = sheet.getRow(currentRow);
      row.height = 20;

      const isFirst = idx === 0;
      const isLast = idx === list.length - 1;
      const isPrevTeamBoundary = isPrivate && idx > 0 && list[idx - 1]?.team === 'A' && drv.team === 'B';
      const isNextTeamBoundary = isPrivate && drv.team === 'A' && list[idx + 1]?.team === 'B';

      const internalStyle: ExcelJS.BorderStyle = isPrivate ? 'dotted' : 'thin';

      const topStyle: ExcelJS.BorderStyle = (isFirst || isPrevTeamBoundary) ? 'medium' : internalStyle;
      const topColor = (isFirst || isPrevTeamBoundary) ? 'FF334155' : 'FF94A3B8';

      const botStyle: ExcelJS.BorderStyle = (isLast || isNextTeamBoundary) ? 'medium' : internalStyle;
      const botColor = (isLast || isNextTeamBoundary) ? 'FF334155' : 'FF94A3B8';

      const fmt = (v: number | undefined) => (v && v > 0 ? v : '-');

      if (isPrivate) {
        sheet.getCell(currentRow, 1).value = drv.team;
        sheet.getCell(currentRow, 2).value = /^\d+$/.test(drv.busNo) ? Number(drv.busNo) : drv.busNo;
        sheet.getCell(currentRow, 3).value = drv.name;

        sheet.getCell(currentRow, 4).value = fmt(drv.totals.workDays);
        sheet.getCell(currentRow, 5).value = fmt(drv.totals.jeolnal);
        sheet.getCell(currentRow, 6).value = fmt(drv.totals.bokgyeok);
        sheet.getCell(currentRow, 7).value = fmt(drv.totals.support);

        months.forEach((m, mIdx) => {
          const st = drv.monthly[m];
          const has = !!st?.hasWorked;
          const sc = 8 + mIdx * 3;
          sheet.getCell(currentRow, sc).value = has ? fmt(st.workDays) : '-';
          sheet.getCell(currentRow, sc + 1).value = has ? fmt(st.jeolnal) : '-';
          sheet.getCell(currentRow, sc + 2).value = has ? fmt(st.bokgyeok) : '-';
        });
      } else {
        sheet.getCell(currentRow, 1).value = /^\d+$/.test(drv.busNo) ? Number(drv.busNo) : drv.busNo;
        sheet.getCell(currentRow, 2).value = drv.name;

        sheet.getCell(currentRow, 3).value = fmt(drv.totals.workDays);
        sheet.getCell(currentRow, 4).value = fmt(drv.totals.sojeong);
        sheet.getCell(currentRow, 5).value = fmt(drv.totals.jeolnal);
        sheet.getCell(currentRow, 6).value = fmt(drv.totals.overtime);
        sheet.getCell(currentRow, 7).value = fmt(drv.totals.extraTotal);
        sheet.getCell(currentRow, 8).value = fmt(drv.totals.longShift);

        months.forEach((m, mIdx) => {
          const st = drv.monthly[m];
          const has = !!st?.hasWorked;
          const sc = 9 + mIdx * 6;
          sheet.getCell(currentRow, sc).value = has ? fmt(st.workDays) : '-';
          sheet.getCell(currentRow, sc + 1).value = has ? fmt(st.sojeong) : '-';
          sheet.getCell(currentRow, sc + 2).value = has ? fmt(st.jeolnal) : '-';
          sheet.getCell(currentRow, sc + 3).value = has ? fmt(st.overtime) : '-';
          sheet.getCell(currentRow, sc + 4).value = has ? fmt(st.extraTotal) : '-';
          sheet.getCell(currentRow, sc + 5).value = has ? fmt(st.longShift) : '-';
        });
      }

      for (let c = 1; c <= totalCols; c++) {
        const cell = sheet.getCell(currentRow, c);
        const isDash = cell.value === '-';
        const isSumCol = c >= sumStartCol && c <= sumEndCol;

        cell.font = {
          name: '맑은 고딕',
          size: 10,
          bold: !isDash && (c <= leftMetaEndCol || isSumCol),
          color: { argb: isDash ? 'FFCBD5E1' : 'FF1E293B' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

        if (isSumCol) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
        }

        cell.border = {
          top: { style: topStyle, color: { argb: topColor } },
          bottom: { style: botStyle, color: { argb: botColor } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
      }

      currentRow++;
    });
  };

  writeDriverList(fullYearDrivers);

  let sepRowIdx = -1;
  if (partialYearDrivers.length > 0) {
    sepRowIdx = currentRow;
    const sepRow = sheet.getRow(sepRowIdx);
    sepRow.height = 22;
    sheet.mergeCells(sepRowIdx, 1, sepRowIdx, totalCols);
    const sepCell = sheet.getCell(sepRowIdx, 1);
    sepCell.value = `▼ 일부 월 근무 (${partialYearDrivers.length}명) - 중도 합류 · 이동 · 퇴사`;
    sepCell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF334155' } };
    sepCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    sepCell.alignment = { horizontal: 'left', vertical: 'middle' };
    currentRow++;

    writeDriverList(partialYearDrivers);
  }

  const lastRow = currentRow - 1;

  applyBoxBorder(sheet, 2, 1, 3, totalCols, 'medium', 'FF334155');
  applyBoxBorder(sheet, 2, 1, lastRow, leftMetaEndCol, 'medium', 'FF334155');
  applyBoxBorder(sheet, 2, sumStartCol, lastRow, sumEndCol, 'medium', 'FF334155');

  months.forEach((_, idx) => {
    const sc = sumEndCol + 1 + idx * monthWidth;
    const ec = sc + monthWidth - 1;
    applyBoxBorder(sheet, 2, sc, lastRow, ec, 'medium', 'FF64748B');
  });

  if (sepRowIdx !== -1) {
    applyBoxBorder(sheet, sepRowIdx, 1, sepRowIdx, totalCols, 'medium', 'FF334155');
  }
  applyBoxBorder(sheet, 2, 1, lastRow, totalCols, 'medium', 'FF334155');

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${route}노선_${year}년_근무통계.xlsx`);
}