// 파일 위치: hooks/useMobileViewport.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function useMobileViewport() {
  const [scale, setScale] = useState<number>(1);
  const [isPortraitMobile, setIsPortraitMobile] = useState<boolean>(false);
  const [dismissedGuard, setDismissedGuard] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);

  const forceEnterLandscape = useCallback(async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      const scr = window.screen as any;
      if (scr?.orientation?.lock) {
        await scr.orientation.lock('landscape');
      }
      sessionStorage.setItem('preferredOrientation', 'LANDSCAPE');
      setDismissedGuard(true);
    } catch {
      setDismissedGuard(true);
    }
  }, []);

  useEffect(() => {
    const checkOrientation = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isMobilePortrait = w < 768 && h > w;
      setIsPortraitMobile(isMobilePortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // 두 손가락 스와이프(Pinch-to-Zoom)로 제목행 + 배차표 동시 확대(180%) 및 축소(45%)
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
        if (e.cancelable) e.preventDefault();
        const currentDist = getDistance(e.touches);
        const ratio = currentDist / pinchStartDistRef.current;
        const nextScale = Math.min(1.8, Math.max(0.45, pinchStartScaleRef.current * ratio));
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