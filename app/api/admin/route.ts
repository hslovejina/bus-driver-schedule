// 파일 위치: app/api/admin/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'GET_SETTINGS') {
      let [setting, configRecord] = await Promise.all([
        prisma.systemSetting.findUnique({ where: { id: 'GLOBAL' } }),
        prisma.monthlyRoster.findUnique({
          where: { route_yearMonth: { route: '__SYSTEM_CONFIG__', yearMonth: 'GLOBAL' } },
        }),
      ]);

      if (!setting) {
        setting = await prisma.systemSetting.create({
          data: { id: 'GLOBAL', baseHourlyWage: 16911 },
        });
      }

      return NextResponse.json({
        ...setting,
        payConfig: (configRecord?.rosterData as any) || { publicRules: [], privateRules: [] },
      });
    }

    if (action === 'UPDATE_WAGE') {
      const { wage, startYearMonth, applyAllPast } = body;
      const now = new Date();
      const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const defaultYm = `${kstTime.getUTCFullYear()}-${String(kstTime.getUTCMonth() + 1).padStart(2, '0')}`;
      const targetStartYm = startYearMonth || defaultYm;

      await prisma.systemSetting.upsert({
        where: { id: 'GLOBAL' },
        update: { baseHourlyWage: wage },
        create: { id: 'GLOBAL', baseHourlyWage: wage },
      });

      if (applyAllPast) {
        await prisma.monthlyRoster.updateMany({
          where: { route: { not: '__SYSTEM_CONFIG__' } },
          data: { hourlyWage: wage },
        });
      } else {
        await prisma.monthlyRoster.updateMany({
          where: {
            route: { not: '__SYSTEM_CONFIG__' },
            yearMonth: { gte: targetStartYm },
          },
          data: { hourlyWage: wage },
        });
      }

      const existingConfig = await prisma.monthlyRoster.findUnique({
        where: { route_yearMonth: { route: '__SYSTEM_CONFIG__', yearMonth: 'GLOBAL' } },
      });
      const currentPayConfig = (existingConfig?.rosterData as any) || {
        publicRules: [],
        privateRules: [],
      };
      const effYm = applyAllPast ? '2000-01' : targetStartYm;
      const filteredPub = (currentPayConfig.publicRules || []).filter(
        (r: any) => !applyAllPast && r.startYearMonth !== effYm
      );
      filteredPub.push({ startYearMonth: effYm, hourlyWage: wage });
      filteredPub.sort((a: any, b: any) => a.startYearMonth.localeCompare(b.startYearMonth));

      const updatedPayConfig = { ...currentPayConfig, publicRules: filteredPub };
      await prisma.monthlyRoster.upsert({
        where: { route_yearMonth: { route: '__SYSTEM_CONFIG__', yearMonth: 'GLOBAL' } },
        update: { rosterData: updatedPayConfig, hourlyWage: wage },
        create: {
          route: '__SYSTEM_CONFIG__',
          yearMonth: 'GLOBAL',
          rosterData: updatedPayConfig,
          hourlyWage: wage,
        },
      });

      return NextResponse.json({ success: true, payConfig: updatedPayConfig });
    }

    if (action === 'UPDATE_PRIVATE_PAY_CONFIG') {
      const { startYearMonth, jeolHourlyWage, safeBonus, payTable, applyAllPast } = body;
      const effYm = applyAllPast ? '2000-01' : startYearMonth || '2000-01';

      const existingConfig = await prisma.monthlyRoster.findUnique({
        where: { route_yearMonth: { route: '__SYSTEM_CONFIG__', yearMonth: 'GLOBAL' } },
      });
      const currentPayConfig = (existingConfig?.rosterData as any) || {
        publicRules: [],
        privateRules: [],
      };

      const filteredPriv = applyAllPast
        ? []
        : (currentPayConfig.privateRules || []).filter((r: any) => r.startYearMonth !== effYm);

      filteredPriv.push({
        startYearMonth: effYm,
        jeolHourlyWage: Number(jeolHourlyWage) || 17201,
        safeBonus: Number(safeBonus ?? 60000),
        payTable,
      });
      filteredPriv.sort((a: any, b: any) => a.startYearMonth.localeCompare(b.startYearMonth));

      const updatedPayConfig = { ...currentPayConfig, privateRules: filteredPriv };
      await prisma.monthlyRoster.upsert({
        where: { route_yearMonth: { route: '__SYSTEM_CONFIG__', yearMonth: 'GLOBAL' } },
        update: { rosterData: updatedPayConfig },
        create: {
          route: '__SYSTEM_CONFIG__',
          yearMonth: 'GLOBAL',
          rosterData: updatedPayConfig,
          hourlyWage: 16911,
        },
      });

      return NextResponse.json({ success: true, payConfig: updatedPayConfig });
    }

    if (action === 'DELETE_PAY_RULE') {
      const { ruleType, startYearMonth } = body;
      const existingConfig = await prisma.monthlyRoster.findUnique({
        where: { route_yearMonth: { route: '__SYSTEM_CONFIG__', yearMonth: 'GLOBAL' } },
      });
      const currentPayConfig = (existingConfig?.rosterData as any) || {
        publicRules: [],
        privateRules: [],
      };
      if (ruleType === 'PUBLIC') {
        currentPayConfig.publicRules = (currentPayConfig.publicRules || []).filter(
          (r: any) => r.startYearMonth !== startYearMonth
        );
      } else {
        currentPayConfig.privateRules = (currentPayConfig.privateRules || []).filter(
          (r: any) => r.startYearMonth !== startYearMonth
        );
      }
      await prisma.monthlyRoster.upsert({
        where: { route_yearMonth: { route: '__SYSTEM_CONFIG__', yearMonth: 'GLOBAL' } },
        update: { rosterData: currentPayConfig },
        create: {
          route: '__SYSTEM_CONFIG__',
          yearMonth: 'GLOBAL',
          rosterData: currentPayConfig,
          hourlyWage: 16911,
        },
      });
      return NextResponse.json({ success: true, payConfig: currentPayConfig });
    }

    if (action === 'GET_USERS') {
      const users = await prisma.user.findMany({ orderBy: { empId: 'asc' } });
      return NextResponse.json(users);
    }

    if (action === 'ADD_USER') {
      const { empId, password, name, birthDate, route, role } = body.payload;
      const exist = await prisma.user.findUnique({ where: { empId } });
      if (exist) return NextResponse.json({ error: '이미 존재하는 사번입니다.' }, { status: 400 });

      const user = await prisma.user.create({
        data: { empId, password, name, birthDate, route, role, isActive: true },
      });
      return NextResponse.json(user);
    }

    if (action === 'UPDATE_USER') {
      const { id, payload } = body;
      const user = await prisma.user.update({ where: { id }, data: payload });
      return NextResponse.json(user);
    }

    if (action === 'DELETE_USER') {
      const { id } = body;
      const user = await prisma.user.findUnique({ where: { id } });
      if (user?.role === 'ADMIN')
        return NextResponse.json({ error: '관리자는 삭제할 수 없습니다.' }, { status: 400 });
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    if (action === 'RESET_PASSWORD') {
      const { id } = body;
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

      await prisma.user.update({ where: { id }, data: { password: user.birthDate } });
      return NextResponse.json({ success: true });
    }

    if (action === 'GET_ROUTES') {
      const routes = await prisma.busRoute.findMany({ orderBy: { name: 'asc' } });
      return NextResponse.json(routes);
    }

    if (action === 'ADD_ROUTE') {
      const { name, routeType } = body;
      const exist = await prisma.busRoute.findUnique({ where: { name } });
      if (exist) return NextResponse.json({ error: '이미 존재하는 노선입니다.' }, { status: 400 });
      const route = await prisma.busRoute.create({
        data: { name, routeType: routeType || 'PUBLIC' },
      });
      return NextResponse.json(route);
    }

    if (action === 'UPDATE_ROUTE') {
      const { id, name, routeType, weekdayCount, satDrops, sunDrops, longShifts } = body;
      const exist = await prisma.busRoute.findFirst({ where: { name, id: { not: id } } });
      if (exist)
        return NextResponse.json({ error: '이미 존재하는 노선 번호입니다.' }, { status: 400 });

      const route = await prisma.busRoute.update({
        where: { id },
        data: {
          name,
          routeType,
          weekdayCount,
          satDrops,
          sunDrops,
          longShifts: Array.isArray(longShifts) ? longShifts : [],
        },
      });
      return NextResponse.json(route);
    }

    if (action === 'DELETE_ROUTE') {
      const { id } = body;
      await prisma.busRoute.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    if (action === 'SYNC_HOLIDAYS') {
      const apiKey = process.env.PUBLIC_DATA_API_KEY;
      if (!apiKey)
        return NextResponse.json(
          { error: '환경변수에 API 키가 설정되지 않았습니다.' },
          { status: 500 }
        );

      const currentYear = new Date().getFullYear();
      const upsertOperations: any[] = [];

      for (const year of [currentYear, currentYear + 1]) {
        const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${apiKey}&solYear=${year}&numOfRows=100&_type=json`;
        const res = await fetch(url);
        const data = await res.json();
        const items = data?.response?.body?.items?.item;

        if (items) {
          const holidayList = Array.isArray(items) ? items : [items];
          for (const item of holidayList) {
            if (item.isHoliday === 'Y') {
              const dateStr = String(item.locdate);
              const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
              upsertOperations.push(
                prisma.holiday.upsert({
                  where: { date: formattedDate },
                  update: { name: item.dateName },
                  create: { date: formattedDate, name: item.dateName },
                })
              );
            }
          }
        }
      }

      if (upsertOperations.length > 0) {
        await prisma.$transaction(upsertOperations);
      }

      return NextResponse.json({
        message: `총 ${upsertOperations.length}개의 공휴일이 DB에 동기화되었습니다.`,
      });
    }

    return NextResponse.json({ error: '알 수 없는 요청입니다.' }, { status: 400 });
  } catch (error: any) {
    console.error('🔥 관리자 API 에러 상세:', error);
    return NextResponse.json({ error: `[서버 상세 오류] ${error.message}` }, { status: 500 });
  }
}