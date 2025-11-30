import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

// Breakpoints alignés avec ResponsiveGameLayout
// NOTE: On garde les mêmes valeurs pour la cohérence logique
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 996;
const DESKTOP_BREAKPOINT = 1200;

function getDeviceType(width: number): DeviceType {
  if (width < MOBILE_BREAKPOINT) return 'mobile';
  if (width < DESKTOP_BREAKPOINT) return 'tablet';
  return 'desktop';
} 

export function useResponsiveLayout(): DeviceType {
  // Initialisation sécurisée pour SSR
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return getDeviceType(window.innerWidth);
  });
  
  useEffect(() => {
    const handleResize = () => {
      // Suppression du debounce pour éviter le clignotement visuel
      // lors du redimensionnement rapide
      const width = window.innerWidth;
      setDeviceType((prev) => {
        const newType = getDeviceType(width);
        return prev === newType ? prev : newType;
      });
    };

    // Appel initial au cas où
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceType;
}