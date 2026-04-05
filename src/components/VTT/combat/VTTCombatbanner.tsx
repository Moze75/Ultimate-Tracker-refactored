import { useRef, useEffect, useCallback } from 'react';

interface SparkData {
  left: string;
  dx: number;
  dy: number;
  delay: string;
  size: number;
  color: string;
}

const SPARK_DATA: SparkData[] = Array.from({ length: 20 }, (_, i) => ({
  left: `${5 + i * 4.75}%`,
  dx: ((i * 37) % 180) - 90,
  dy: -20 - ((i * 13) % 60),
  delay: (((i * 0.025) % 0.4)).toFixed(3),
  size: 2 + (i % 3),
  color: i % 3 === 0 ? '#f0c040' : i % 3 === 1 ? '#e05020' : '#ff9030',
}));

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&display=swap');

.cb-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cb-banner {
  position: absolute;
  width: 100%;
  background: linear-gradient(to bottom, #0a0000, #1c0404 30%, #220808 50%, #1c0404 70%, #0a0000);
  border-top: 2.5px solid #8b1a1a;
  border-bottom: 2.5px solid #8b1a1a;
  overflow: hidden;
  transform-origin: center;
  transform: scaleY(0);
  display: none;
}
.cb-banner::before, .cb-banner::after {
  content: '';
  display: block;
  height: 1px;
  margin: 0 48px;
  background: linear-gradient(to right, transparent, rgba(201,168,76,0.5) 20%, rgba(240,208,100,0.9) 50%, rgba(201,168,76,0.5) 80%, transparent);
}
.cb-banner::before { margin-top: 6px; }
.cb-banner::after  { margin-bottom: 6px; }
.cb-banner.cb-running { display: block; }
.cb-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 22px 48px;
  position: relative;
}
.cb-sweep {
  position: absolute;
  top: 0;
  left: -80%;
  width: 60%;
  height: 100%;
  background: linear-gradient(to right, transparent, rgba(255,210,120,0.12), transparent);
  pointer-events: none;
}
.cb-icon {
  font-size: 30px;
  color: #c9a84c;
  filter: drop-shadow(0 0 6px rgba(201,168,76,0.6));
  display: inline-block;
  opacity: 0;
}
.cb-icon-flip { transform: scaleX(-1); }
.cb-text {
  font-family: 'Cinzel', serif;
  font-weight: 400;
  font-size: clamp(16px, 3vw, 32px);
  color: #f2c840;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 0 18px rgba(220,60,20,0.9), 0 0 36px rgba(200,40,10,0.5), 0 2px 4px rgba(0,0,0,0.9);
  opacity: 0;
}
.cb-sparks { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.cb-spark  { position: absolute; border-radius: 50%; bottom: 50%; opacity: 0; }

@keyframes cb-slam { 0%{transform:scaleY(0)} 65%{transform:scaleY(1.06)} 82%{transform:scaleY(0.97)} 100%{transform:scaleY(1)} }
@keyframes cb-rip  { 0%{transform:scaleY(1) translateY(0);opacity:1} 15%{transform:scaleY(1.04) translateY(-4px);opacity:1} 100%{transform:scaleY(0) translateY(-12px);opacity:0} }
@keyframes cb-text-in { 0%{opacity:0;letter-spacing:0.55em;filter:brightness(4)} 55%{opacity:1;filter:brightness(1.6)} 100%{opacity:1;letter-spacing:0.16em;filter:brightness(1)} }
@keyframes cb-text-pulse {
  0%,100%{text-shadow:0 0 18px rgba(220,60,20,.9),0 0 36px rgba(200,40,10,.5),0 2px 4px rgba(0,0,0,.9)}
  50%{text-shadow:0 0 28px rgba(255,150,40,1),0 0 52px rgba(220,60,20,.7),0 2px 4px rgba(0,0,0,.9)}
}
@keyframes cb-icon-in   { 0%{opacity:0;transform:scale(0.4)} 70%{transform:scale(1.15);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes cb-icon-flip { 0%{opacity:0;transform:scaleX(-1) scale(0.4)} 70%{transform:scaleX(-1) scale(1.15);opacity:1} 100%{transform:scaleX(-1) scale(1);opacity:1} }
@keyframes cb-sweep { 0%{left:-60%;opacity:1} 100%{left:130%;opacity:0} }
@keyframes cb-spark { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0} }
`;

interface CombatBannerProps {
  trigger: number;
  label?: string;
}

export default function CombatBanner({ trigger, label = 'Début du Combat' }: CombatBannerProps) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const sparksRef = useRef<HTMLDivElement>(null);
  const sweepRef  = useRef<HTMLDivElement>(null);
  const textRef   = useRef<HTMLSpanElement>(null);
  const iconLRef  = useRef<HTMLSpanElement>(null);
  const iconRRef  = useRef<HTMLSpanElement>(null);
  const t1Ref     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2Ref     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = 'cb-styles';
    if (!document.getElementById(id)) {
      const tag = document.createElement('style');
      tag.id = id;
      tag.textContent = STYLES;
      document.head.appendChild(tag);
    }
    return () => {
      if (t1Ref.current) clearTimeout(t1Ref.current);
      if (t2Ref.current) clearTimeout(t2Ref.current);
    };
  }, []);

  const play = useCallback((text: string) => {
    const banner = bannerRef.current;
    const sparks = sparksRef.current;
    const sweep  = sweepRef.current;
    const textEl = textRef.current;
    const iconL  = iconLRef.current;
    const iconR  = iconRRef.current;
    if (!banner || !sparks || !sweep || !textEl || !iconL || !iconR) return;

    if (t1Ref.current) clearTimeout(t1Ref.current);
    if (t2Ref.current) clearTimeout(t2Ref.current);

    textEl.textContent = text;

    sparks.innerHTML = '';
    SPARK_DATA.forEach((s) => {
      const d = document.createElement('div');
      d.className = 'cb-spark';
      d.style.cssText = `left:${s.left};width:${s.size}px;height:${s.size}px;background:${s.color};--dx:${s.dx}px;--dy:${s.dy}px;`;
      d.style.animationDelay = `${s.delay}s`;
      sparks.appendChild(d);
    });

    banner.className = 'cb-banner cb-running';
    banner.style.animation = 'cb-slam 0.32s cubic-bezier(0.15,0,0.1,1) both';
    sweep.style.animation  = 'cb-sweep 0.55s 0.28s ease-out forwards';
    textEl.style.animation = 'cb-text-in 0.45s 0.28s cubic-bezier(0.2,0,0.1,1) both, cb-text-pulse 1.8s 0.73s ease-in-out infinite';
    iconL.style.animation  = 'cb-icon-flip 0.4s 0.3s ease-out both';
    iconR.style.animation  = 'cb-icon-in 0.4s 0.3s ease-out both';
    sparks.querySelectorAll<HTMLElement>('.cb-spark').forEach((el) => {
      el.style.animation = `cb-spark 0.5s ${el.style.animationDelay} ease-out both`;
    });

    t1Ref.current = setTimeout(() => {
      banner.style.animation = 'cb-rip 0.38s cubic-bezier(0.6,0,1,0.6) both';
    }, 2100);

    t2Ref.current = setTimeout(() => {
      banner.className       = 'cb-banner';
      banner.style.animation = '';
      textEl.style.animation = '';
      iconL.style.animation  = '';
      iconR.style.animation  = '';
      sweep.style.animation  = '';
    }, 2500);
  }, []);

  useEffect(() => {
    if (trigger > 0) {
      play(label);
    }
  }, [trigger, label, play]);

  return (
    <div className="cb-overlay">
      <div className="cb-banner" ref={bannerRef}>
        <div className="cb-sparks" ref={sparksRef} />
        <div className="cb-content">
          <div className="cb-sweep" ref={sweepRef} />
          <span className="cb-icon cb-icon-flip" ref={iconLRef}>⚔</span>
          <span className="cb-text" ref={textRef} />
          <span className="cb-icon" ref={iconRRef}>⚔</span>
        </div>
      </div>
    </div>
  );
}
