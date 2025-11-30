import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

// On garde 768 comme SEULE frontière importante
const MOBILE_BREAKPOINT = 1050;

function getDeviceType(width: number): DeviceType {
  if (width < MOBILE_BREAKPOINT) return 'mobile';
  // MODIFICATION : On retourne 'desktop' directement pour tout ce qui est plus grand que mobile.
  // On supprime la distinction "tablette" ici.
  return 'desktop';
} 

export function useResponsiveLayout(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return getDeviceType(window.innerWidth);
  });
  
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setDeviceType((prev) => {
        const newType = getDeviceType(width);
        return prev === newType ? prev : newType;
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceType;
}