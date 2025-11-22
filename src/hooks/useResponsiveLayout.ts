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
      const width = window.innerWidth;
      let newDeviceType: DeviceType;

      if (width < MOBILE_BREAKPOINT) {
        newDeviceType = 'mobile';
      } else if (width < DESKTOP_BREAKPOINT) {
        newDeviceType = 'tablet';
      } else {
        newDeviceType = 'desktop';
      }

      setDeviceType((prev) => (prev === newDeviceType ? prev : newDeviceType));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceType;
}
 