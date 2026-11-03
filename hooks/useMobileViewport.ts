// 파일 위치: hooks/useMobileViewport.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function useMobileViewport() {
  const [scale, setScale] = useState<number>(1);
  const [isPortraitMobile, setIsPortraitMobile] = useState<boolean>(false);
  const [dismissedGuard, setDismissedGuard] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);

  // 1. 스마트폰 세로(Portrait) 상태 감지 및 자동 가로모드 전환 시도
  const tryLockLandscape = useCallback(async () => {
    try {
      const scr = window.screen as any;
      if (scr?.orientation?.lock) {
        await scr.orientation.lock('landscape');
      }
    } catch {
      // 일반 브라우저 탭에서는 전체화면 전환 후 가로 잠금 가능
    }
  }, []);

  const forceEnterLandscape = useCallback(async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      const scr = window.screen as any;
      if (scr?.orientation?.lock) {
        await scr.orientation.lock('landscape');
      }
      setDismissedGuard(true);
    } catch {
      setDismissedGuard(true);
    }
  }, []);

  useEffect(() => {
    const checkOrientation = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // 스마트폰 화면 폭(가로 768px 미만)이면서 세로가 가로보다 긴 경우
      const isMobilePortrait = w < 768 && h > w;
      setIsPortraitMobile(isMobilePortrait);
      if (!isMobilePortrait) {
        setDismissedGuard(false);
      }
    };

    checkOrientation();
    tryLockLandscape();

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [tryLockLandscape]);

  // 2. 두 손가락 스와이프(Pinch-to-Zoom)로 배차표 확대(180%) 및 축소(55%)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDistRef.current = getDistance(e.touches);
        pinchStartScaleRef.current = scale;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
        // 두 손가락 확대/축소 시 브라우저 기본 튕김 방지 후 표 배율 조절
        if (e.cancelable) e.preventDefault();
        const currentDist = getDistance(e.touches);
        const ratio = currentDist / pinchStartDistRef.current;
        const nextScale = Math.min(1.8, Math.max(0.55, pinchStartScaleRef.current * ratio));
        setScale(Math.round(nextScale * 100) / 100);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartDistRef.current = null;
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [scale]);

  const resetScale = useCallback(() => setScale(1), []);

  return {
    containerRef,
    scale,
    resetScale,
    showLandscapePrompt: isPortraitMobile && !dismissedGuard,
    forceEnterLandscape,
    dismissLandscapePrompt: () => setDismissedGuard(true),
  };
}