import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'desktop';

const DESKTOP_BREAKPOINT = 824;

export function useResponsiveLayout(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === 'undefined') return 'mobile';
    return window.innerWidth >= DESKTOP_BREAKPOINT ? 'desktop' : 'mobile';
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
 