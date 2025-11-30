import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

const MOBILE_BREAKPOINT = 700;
const TABLET_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

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

  useEffect(() => {
    // Vérifier immédiatement au montage (pour corriger les problèmes de SSR/hydratation)
    const initialWidth = window.innerWidth;
    const initialDeviceType = getDeviceType(initialWidth);
    if (initialDeviceType !== deviceType) {
      setDeviceType(initialDeviceType);
    }

    const handleResize = () => {
      const width = window.innerWidth;
      const newDeviceType = getDeviceType(width);
      setDeviceType((prev) => (prev === newDeviceType ? prev : newDeviceType));
    };

    window. addEventListener('resize', handleResize);
    return () => window. removeEventListener('resize', handleResize);
  }, []);

  return deviceType;
} 