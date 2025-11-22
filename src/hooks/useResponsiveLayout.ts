import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'desktop';

const MOBILE_BREAKPOINT = 700;
const DESKTOP_BREAKPOINT = 1024;

export function useResponsiveLayout(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < MOBILE_BREAKPOINT) return 'mobile';
    if (width < DESKTOP_BREAKPOINT) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      const newDeviceType = window.innerWidth >= DESKTOP_BREAKPOINT ? 'desktop' : 'mobile';
      setDeviceType(newDeviceType);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceType;
}
 