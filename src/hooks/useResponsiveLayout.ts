import { useEffect, useState } from 'react';

type DeviceType = 'mobile' | 'tablet' | 'desktop';

export function useResponsiveLayout(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === 'undefined') {
      return 'desktop';
    }
    const width = window.innerWidth;
    if (width < 480) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;

      let next: DeviceType;
      if (width < 480) next = 'mobile';
      else if (width < 1024) next = 'tablet';
      else next = 'desktop';

      setDeviceType((prev) => (prev === next ? prev : next));
    };

    // Appel immédiat pour être sûr de coller à la largeur actuelle
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return deviceType;
}