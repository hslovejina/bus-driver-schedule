// 파일 위치: app/api/users/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function GET() {
  try {
    await prisma.user.upsert({
      where: { empId: '621028' },
      update: { birthDate: '790818' },
      create: { empId: '621028', password: '790818', name: '김현수D', birthDate: '790818', route: '3103', role: 'ADMIN', isActive: true }
    });
    
    await prisma.user.upsert({
      where: { empId: '621107' },
      update: { birthDate: '740805' },
      create: { empId: '621107', password: '740805', name: '이재두', birthDate: '740805', route: '99-1', role: 'USER', isActive: true }
    });

    return NextResponse.json({ message: '✅ 지정하신 초기 회원(2명) DB 셋업이 완료되었습니다!' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'DB 세팅 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { empId, password } = await request.json();
    if (!empId || !password) return NextResponse.json({ error: '입력값이 부족합니다.' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { empId } });
    if (!user || user.password !== password) {
      return NextResponse.json({ error: '사원번호 또는 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' }, { status: 403 });
    }

    const { password: _, ...userInfo } = user; 
    return NextResponse.json({ success: true, user: userInfo }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: '서버 통신 오류' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { action, empId } = body;

    if (!empId || !action) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    // ✨ 핵심: 앱에 들어올 때마다 서버에서 내 최신 정보를 내려줍니다.
    if (action === 'GET_LATEST_INFO') {
      const user = await prisma.user.findUnique({ where: { empId } });
      if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
      
      const { password: _, ...userInfo } = user;
      return NextResponse.json({ success: true, user: userInfo }, { status: 200 });
    }

    if (action === 'CHANGE_PASSWORD') {
      const { oldPassword, newPassword } = body;
      const user = await prisma.user.findUnique({ where: { empId } });
      
      if (!user || user.password !== oldPassword) {
        return NextResponse.json({ error: '기존 비밀번호가 일치하지 않습니다.' }, { status: 401 });
      }
      
      await prisma.user.update({
        where: { empId },
        data: { password: newPassword }
      });
      return NextResponse.json({ success: true, message: '비밀번호가 안전하게 변경되었습니다.' }, { status: 200 });
    }

    return NextResponse.json({ error: '알 수 없는 요청입니다.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: '서버 업데이트 오류' }, { status: 500 });
  }
}