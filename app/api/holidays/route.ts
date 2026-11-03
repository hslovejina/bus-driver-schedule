// 파일 위치: app/api/holidays/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    const holidays = await prisma.holiday.findMany({
      where: { date: { startsWith: year } },
      select: { date: true, name: true },
    });

    const holidayMap: Record<string, string> = {};
    holidays.forEach(h => {
      holidayMap[h.date] = h.name;
    });

    // 근로자의 날 및 2026년 이후 제헌절 강제 추가 (급여계산기 앱과 100% 동일 기준)
    holidayMap[`${year}-05-01`] = '근로자의 날';
    if (Number(year) >= 2026) {
      holidayMap[`${year}-07-17`] = '제헌절';
    }

    return NextResponse.json(holidayMap);
  } catch (error) {
    console.error('공휴일 조회 에러:', error);
    const fallbackYear = new URL(request.url).searchParams.get('year') || new Date().getFullYear().toString();
    const fallbackMap: Record<string, string> = { [`${fallbackYear}-05-01`]: '근로자의 날' };
    if (Number(fallbackYear) >= 2026) {
      fallbackMap[`${fallbackYear}-07-17`] = '제헌절';
    }
    return NextResponse.json(fallbackMap);
  }
}