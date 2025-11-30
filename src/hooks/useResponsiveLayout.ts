import { useState, useEffect, useRef } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

// Breakpoints alignés avec ResponsiveGameLayout
const MOBILE_BREAKPOINT = 768;   // sm breakpoint
const DESKTOP_BREAKPOINT = 1200; // lg breakpoint

function getDeviceType(width: number): DeviceType {
  if (width < MOBILE_BREAKPOINT) return 'mobile';
  if (width < DESKTOP_BREAKPOINT) return 'tablet';
  return 'desktop';
}

export function useResponsiveLayout(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return getDeviceType(window.innerWidth);
  });
  
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Vérifier immédiatement au montage (pour corriger les problèmes de SSR/hydratation)
    const initialWidth = window.innerWidth;
    const initialDeviceType = getDeviceType(initialWidth);
    setDeviceType(initialDeviceType);

    const handleResize = () => {
      // Debounce pour éviter le clignotement
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      resizeTimeoutRef.current = setTimeout(() => {
        const width = window.innerWidth;
        const newDeviceType = getDeviceType(width);
        setDeviceType((prev) => (prev === newDeviceType ? prev : newDeviceType));
      }, 100); // 100ms de debounce
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  return deviceType;
}