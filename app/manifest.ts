// 파일 위치: app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '배차메이커 - 버스 승무원 월간 근무 계획표',
    short_name: '배차메이커',
    description: '공공관리제 및 민영제 버스 노선 월간 배차·근무 통계 관리 시스템',
    start_url: '/',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#f8fafc',
    theme_color: '#1e3a8a',
    icons: [
      {
        src: '/icon.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
      {
        src: '/apple-icon.jpg',
        sizes: '180x180',
        type: 'image/jpeg',
      },
    ],
  };
}