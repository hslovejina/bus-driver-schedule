// 파일 위치: app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '배차메이커 - 버스 승무원 월간 근무 계획표',
  description: '공공관리제 및 민영제 버스 노선 월간 배차·근무 통계 관리 시스템',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '배차메이커',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased bg-white text-slate-900">{children}</body>
    </html>
  );
}