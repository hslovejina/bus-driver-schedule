// 파일 위치: app/api/roster/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

const resolvePublicWageForYm = (payConfig: any, ym: string, fallback: number) => {
  const pubRules = payConfig?.publicRules || [];
  if (pubRules.length === 0) return fallback;
  const sorted = [...pubRules].sort((a: any, b: any) =>
    a.startYearMonth.localeCompare(b.startYearMonth)
  );
  let matched = fallback;
  for (const r of sorted) {
    if (r.startYearMonth <= ym) matched = r.hourlyWage;
  }
  return matched;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const route = searchParams.get('route');
    const yearMonth = searchParams.get('yearMonth');
    const year = searchParams.get('year');
    const includeAdjacent = searchParams.get('includeAdjacent') === 'true';

    // 1. 연간 통계 탭용 일괄 조회 (단 1회 병렬 쿼리)
    if (route && year && !yearMonth) {
      const prevYearDec = `${Number(year) - 1}-12`;

      const [configRecord, rosters, routeInfo, allRoutes, holidaysList, setting] =
        await Promise.all([
          prisma.monthlyRoster.findUnique({
            where: { route_yearMonth: { route: '__SYSTEM_CONFIG__', yearMonth: 'GLOBAL' } },
          }),
          prisma.monthlyRoster.findMany({
            where: {
              route,
              OR: [{ yearMonth: { startsWith: `${year}-` } }, { yearMonth: prevYearDec }],
            },
            orderBy: { yearMonth: 'asc' },
          }),
          prisma.busRoute.findUnique({ where: { name: route } }),
          prisma.busRoute.findMany({
            select: { name: true, routeType: true },
            orderBy: { name: 'asc' },
          }),
          prisma.holiday.findMany({
            where: { date: { startsWith: year } },
            select: { date: true, name: true },
          }),
          prisma.systemSetting.findUnique({ where: { id: 'GLOBAL' } }),
        ]);

      const payConfig = (configRecord?.rosterData as any) || {
        publicRules: [],
        privateRules: [],
      };

      const holidayMap: Record<string, string> = {};
      holidaysList.forEach(h => {
        holidayMap[h.date] = h.name;
      });
      holidayMap[`${year}-05-01`] = '근로자의 날';
      if (Number(year) >= 2026) {
        holidayMap[`${year}-07-17`] = '제헌절';
      }

      return NextResponse.json(
        {
          rosters,
          routeInfo,
          allRoutes,
          holidays: holidayMap,
          defaultHourlyWage: setting?.baseHourlyWage || 16911,
          payConfig,
        },
        { status: 200 }
      );
    }

    if (!route || !yearMonth) {
      return NextResponse.json(
        { error: 'route와 yearMonth 파라미터가 모두 필요합니다.' },
        { status: 400 }
      );
    }

    // 2. 월간 배차표 통합 조회 (전월·당월·익월 배차표 + 노선정보 + 시급설정을 단 1회 병렬 쿼리로 처리)
    if (includeAdjacent) {
      const [yStr, mStr] = yearMonth.split('-');
      const y = Number(yStr);
      const m = Number(mStr);

      const prevDate = new Date(y, m - 2, 1);
      const prevYearMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      const nextDate = new Date(y, m, 1);
      const nextYearMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

      const [configRecord, rostersList, routeInfo, allRoutes, setting] = await Promise.all([
        prisma.monthlyRoster.findUnique({
          where: { route_yearMonth: { route: '__SYSTEM_CONFIG__', yearMonth: 'GLOBAL' } },
        }),
        prisma.monthlyRoster.findMany({
          where: {
            route,
            yearMonth: { in: [prevYearMonth, yearMonth, nextYearMonth] },
          },
        }),
        prisma.busRoute.findUnique({
          where: { name: route },
        }),
        prisma.busRoute.findMany({
          select: { name: true, routeType: true },
          orderBy: { name: 'asc' },
        }),
        prisma.systemSetting.findUnique({
          where: { id: 'GLOBAL' },
        }),
      ]);

      const payConfig = (configRecord?.rosterData as any) || {
        publicRules: [],
        privateRules: [],
      };

      const rosterMap = new Map<string, any>();
      rostersList.forEach(r => rosterMap.set(r.yearMonth, r));

      const currentRoster = rosterMap.get(yearMonth);
      const prevRoster = rosterMap.get(prevYearMonth);
      const nextRoster = rosterMap.get(nextYearMonth);

      const baseWage = setting?.baseHourlyWage || 16911;
      const effectiveWage = currentRoster
        ? currentRoster.hourlyWage
        : resolvePublicWageForYm(payConfig, yearMonth, baseWage);

      return NextResponse.json(
        {
          rosterData: currentRoster?.rosterData || [],
          prevRosterData: prevRoster?.rosterData || [],
          nextRosterData: nextRoster?.rosterData || [],
          hourlyWage: effectiveWage,
          routeInfo,
          allRoutes,
          payConfig,
        },
        { status: 200 }
      );
    }

    // 3. 단일 월 배차표 조회 (하위 호환 유지)
    const [configRecord, roster, routeInfo, setting] = await Promise.all([
      prisma.monthlyRoster.findUnique({
        where: { route_yearMonth: { route: '__SYSTEM_CONFIG__', yearMonth: 'GLOBAL' } },
      }),
      prisma.monthlyRoster.findUnique({
        where: { route_yearMonth: { route, yearMonth } },
      }),
      prisma.busRoute.findUnique({
        where: { name: route },
      }),
      prisma.systemSetting.findUnique({
        where: { id: 'GLOBAL' },
      }),
    ]);

    const payConfig = (configRecord?.rosterData as any) || {
      publicRules: [],
      privateRules: [],
    };

    if (roster) {
      return NextResponse.json(
        { rosterData: roster.rosterData, hourlyWage: roster.hourlyWage, routeInfo, payConfig },
        { status: 200 }
      );
    } else {
      const baseWage = setting?.baseHourlyWage || 16911;
      const effectiveWage = resolvePublicWageForYm(payConfig, yearMonth, baseWage);
      return NextResponse.json(
        { rosterData: [], hourlyWage: effectiveWage, routeInfo, payConfig },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('배차표 조회 에러:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, route, yearMonth, rosterData, hourlyWage } = body;

    if (!route || !yearMonth) {
      return NextResponse.json({ error: '필수 데이터가 누락되었습니다.' }, { status: 400 });
    }

    if (action === 'IMPORT_PREVIOUS') {
      const pastRoster = await prisma.monthlyRoster.findFirst({
        where: { route, yearMonth: { lt: yearMonth } },
        orderBy: { yearMonth: 'desc' },
      });

      if (!pastRoster || !pastRoster.rosterData || (pastRoster.rosterData as any[]).length === 0) {
        return NextResponse.json({ error: '불러올 이전 배차 데이터가 없습니다.' }, { status: 404 });
      }

      const pastData = pastRoster.rosterData as any[];
      const inheritedBaseData = pastData.map(group => ({
        ...group,
        drivers: group.drivers.map((driver: any) => ({
          ...driver,
          schedules: {},
          baseSchedules: {},
          defaultRestDays: Array.isArray(driver.defaultRestDays) ? driver.defaultRestDays : [],
        })),
      }));

      const updatedRoster = await prisma.monthlyRoster.upsert({
        where: { route_yearMonth: { route, yearMonth } },
        update: { rosterData: inheritedBaseData, hourlyWage },
        create: { route, yearMonth, rosterData: inheritedBaseData, hourlyWage },
      });

      return NextResponse.json(
        { success: true, rosterData: updatedRoster.rosterData, hourlyWage: updatedRoster.hourlyWage },
        { status: 200 }
      );
    }

    const updatedRoster = await prisma.monthlyRoster.upsert({
      where: { route_yearMonth: { route, yearMonth } },
      update: { rosterData, hourlyWage },
      create: { route, yearMonth, rosterData, hourlyWage },
    });

    return NextResponse.json({ success: true, rosterData: updatedRoster.rosterData }, { status: 200 });
  } catch (error) {
    console.error('배차표 저장 에러:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}