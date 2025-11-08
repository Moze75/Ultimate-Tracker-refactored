// src/utils/healthGlow.ts

class HealthGlowEffect {
  private haloMap = new Map<HTMLElement, {
    wrap: HTMLDivElement;
    clone: HTMLDivElement;
  }>();
  
  private particlesInterval: number | null = null;
  private shieldActiveLast = false;
  private schedulerTimer: number | null = null;
  private lastTick = performance.now();
  private cssInjected = false;

  private readonly HALO_CLASS = 'hp-halo-wrap';
  private readonly PARTICLE_CLASS = 'shield-spark';
  private readonly WAKE_GAP_MS = 5000;
  private readonly BURST_FRAMES = 6;
  private readonly BURST_DELAY = 80;
  private readonly hiddenBackoffMs = 4000;
  private readonly visibleCadenceMs = 1000;

  private prefersReducedMotion = 
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    this.injectCssOnce();
    this.startLifecycleListeners();
  }

  private injectCssOnce() {
    if (this.cssInjected) return;
    this.cssInjected = true;

    const st = document.createElement('style');
    st.id = 'hp-glow-style';
    st.textContent = `
      :root { --hp-shrink: 0.00; }

      @keyframes zone-green-kf {
        0% { transform: scale(1); }
        30% { transform: scale(calc(1 - (var(--hp-shrink) * 0.4))); }
        60% { transform: scale(1); }
        100% { transform: scale(calc(1 - (var(--hp-shrink) * 0.4))); }
      }
      @keyframes zone-yellow-kf {
        0% { transform: scale(1); }
        25% { transform: scale(calc(1 - (var(--hp-shrink) * 0.6))); }
        50% { transform: scale(1); }
        75% { transform: scale(calc(1 - (var(--hp-shrink) * 0.6))); }
        100% { transform: scale(1); }
      }
      @keyframes zone-orange-kf {
        0% { transform: scale(1); }
        30% { transform: scale(calc(1 - (var(--hp-shrink) * 0.8))); }
        60% { transform: scale(1); }
        100% { transform: scale(calc(1 - (var(--hp-shrink) * 0.8))); }
      }
      @keyframes zone-red-kf {
        0% { transform: scale(1); }
        8% { transform: scale(calc(1 - var(--hp-shrink))); }
        14% { transform: scale(calc(1 - (var(--hp-shrink) * 0.3))); }
        20% { transform: scale(calc(1 - (var(--hp-shrink) * 0.6))); }
        35% { transform: scale(1); }
        100% { transform: scale(1); }
      }
      @keyframes zone-shield-kf {
        0% { transform: scale(1); }
        50% { transform: scale(calc(1 - (var(--hp-shrink) * 0.3))); }
        100% { transform: scale(1); }
      }

      .${this.HALO_CLASS} {
        position: absolute;
        pointer-events: none;
        z-index: 10;
        border-radius: inherit;
        animation-iteration-count: infinite;
        animation-timing-function: cubic-bezier(0.3, 0.0, 0.4, 1);
        display: none;
      }
      
      .${this.HALO_CLASS}.zone-green  { 
        animation-name: zone-green-kf;  
        animation-duration: ${this.prefersReducedMotion ? '3.0s' : '2.0s'}; 
      }
      .${this.HALO_CLASS}.zone-yellow { 
        animation-name: zone-yellow-kf; 
        animation-duration: ${this.prefersReducedMotion ? '2.0s' : '1.2s'}; 
      }
      .${this.HALO_CLASS}.zone-orange { 
        animation-name: zone-orange-kf; 
        animation-duration: ${this.prefersReducedMotion ? '1.2s' : '0.6s'}; 
      }
      .${this.HALO_CLASS}.zone-red    { 
        animation-name: zone-red-kf;    
        animation-duration: ${this.prefersReducedMotion ? '2.0s' : '1.2s'}; 
      }
      .${this.HALO_CLASS}.zone-shield { 
        animation-name: zone-shield-kf; 
        animation-duration: ${this.prefersReducedMotion ? '3.5s' : '2.5s'}; 
      }

      .${this.PARTICLE_CLASS} {
        position: absolute;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        pointer-events: none;
        background: radial-gradient(circle at 30% 30%, rgba(0,255,255,0.9) 0%, rgba(0,255,255,0) 70%);
        mix-blend-mode: screen;
        opacity: 0.8;
        z-index: 11;
        animation: shield-spark-fade 1s linear forwards;
      }
      
      @keyframes shield-spark-fade {
        0% { transform: translateY(0px) scale(1); opacity:0.8; }
        100% { transform: translateY(-20px) scale(0.4); opacity:0; }
      }
    `;
    document.head.appendChild(st);
  }

  private zoneForHpPercent(pct: number, hasShield: boolean): string {
    if (hasShield) return 'shield';
    if (pct <= 0.10) return 'red';
    if (pct <= 0.20) return 'orange';
    if (pct <= 0.30) return 'yellow';
    if (pct <= 0.50) return 'green';
    return 'off';
  }

  private zoneColorInfo(zone: string): { rgb: string; alpha: number } {
    switch (zone) {
      case 'red':    return { rgb: '255,0,0',   alpha: 0.75 };
      case 'orange': return { rgb: '255,140,0', alpha: 0.5  };
      case 'yellow': return { rgb: '255,255,0', alpha: 0.3  };
      case 'green':  return { rgb: '153,173,0', alpha: 0.3  };
      default:       return { rgb: '0,0,0',     alpha: 0    };
    }
  }

  private shrinkForPct(pct: number): number {
    const base = 0.5;
    const clamped = Math.max(0, Math.min(pct, base));
    const intensity = 1 - (clamped / base);
    return 0.008 + 0.012 * intensity;
  }

  private ensureHalo(targetEl: HTMLElement): { wrap: HTMLDivElement; clone: HTMLDivElement } {
    if (this.haloMap.has(targetEl)) {
      return this.haloMap.get(targetEl)!;
    }

    const rect = targetEl.getBoundingClientRect();
    
    const wrap = document.createElement('div');
    wrap.className = this.HALO_CLASS;
    wrap.style.position = 'absolute';
    wrap.style.left = (rect.left + window.scrollX) + 'px';
    wrap.style.top = (rect.top + window.scrollY) + 'px';
    wrap.style.width = rect.width + 'px';
    wrap.style.height = rect.height + 'px';

const clone = document.createElement('div');
clone.style.position = 'absolute';
clone.style.inset = '0';
clone.style.border = '1px solid rgba(55, 65, 81, 0.3)'; // ✨ Bordure très fine, presque invisible (gris foncé semi-transparent)
clone.style.borderRadius = 'inherit';
clone.style.pointerEvents = 'none';
clone.style.boxShadow = '0 0 0 3px rgba(255,0,0,0.01)'; // ✨ Ombre interne quasi-invisible pour créer une surface

wrap.appendChild(clone);
    document.body.appendChild(wrap);

    const rec = { wrap, clone };
    this.haloMap.set(targetEl, rec);
    return rec;
  }

  private layoutHalos() {
    for (const [targetEl, rec] of this.haloMap.entries()) {
      if (!targetEl.isConnected) {
        rec.wrap.remove();
        this.haloMap.delete(targetEl);
        continue;
      }

      const rect = targetEl.getBoundingClientRect();
      rec.wrap.style.left = (rect.left + window.scrollX) + 'px';
      rec.wrap.style.top = (rect.top + window.scrollY) + 'px';
      rec.wrap.style.width = rect.width + 'px';
      rec.wrap.style.height = rect.height + 'px';
    }
  }

  private spawnOneParticle(rec: { wrap: HTMLDivElement }) {
    if (!rec || !rec.wrap) return;
    const rect = rec.wrap.getBoundingClientRect();
    const p = document.createElement('div');
    p.className = this.PARTICLE_CLASS;

    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    if (side === 0) { x = Math.random() * rect.width; y = 0; }
    else if (side === 1) { x = rect.width; y = Math.random() * rect.height; }
    else if (side === 2) { x = Math.random() * rect.width; y = rect.height; }
    else { x = 0; y = Math.random() * rect.height; }

    p.style.left = (rect.left + window.scrollX + x - 3) + "px";
    p.style.top = (rect.top + window.scrollY + y - 3) + "px";

    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }

  private startParticles() {
    if (this.particlesInterval || this.prefersReducedMotion) return;
    if (document.hidden) return;
    
    this.particlesInterval = window.setInterval(() => {
      for (const rec of this.haloMap.values()) {
        if (!rec.wrap || rec.wrap.style.display === 'none') continue;
        this.spawnOneParticle(rec);
      }
    }, 400);
  }

  private stopParticles() {
    if (this.particlesInterval) {
      clearInterval(this.particlesInterval);
      this.particlesInterval = null;
    }
    document.querySelectorAll(`.${this.PARTICLE_CLASS}`).forEach(n => n.remove());
  }

  public updateGlow(targetEl: HTMLElement, currentHp: number, maxHp: number, tempHp: number = 0) {
    const pct = maxHp > 0 ? currentHp / maxHp : 1;
    const hasShield = (currentHp >= maxHp) && (tempHp > 0);
    const zone = this.zoneForHpPercent(pct, hasShield);

    const rec = this.ensureHalo(targetEl);
    const { wrap, clone } = rec;

    wrap.classList.remove('zone-green', 'zone-yellow', 'zone-orange', 'zone-red', 'zone-shield');

    if (zone === 'off') {
      wrap.style.display = 'none';
      return;
    }

    wrap.style.display = 'block';
    wrap.classList.add('zone-' + zone);

    const shrinkVal = zone === 'shield' ? 0.010 : this.shrinkForPct(pct);
    document.documentElement.style.setProperty('--hp-shrink', shrinkVal.toFixed(3));

    const { rgb, alpha } = this.zoneColorInfo(zone);
    const shieldRgb = '0,200,255';
    const shieldAlpha = 0.6;

if (zone === 'shield') {
 clone.style.boxShadow = `0 0 0 3px rgba(${shieldRgb},0.01)`;
  wrap.style.filter = `
    drop-shadow(0 0 6px rgba(${shieldRgb},${shieldAlpha}))
    drop-shadow(0 0 12px rgba(${shieldRgb},${shieldAlpha}))
    drop-shadow(0 0 18px rgba(${shieldRgb},${shieldAlpha}))
    drop-shadow(0 0 24px rgba(${shieldRgb},${shieldAlpha}))
  `;
} else {
 clone.style.boxShadow = `0 0 0 3px rgba(${rgb},0.01)`; // ✨ Quasi-invisible
  wrap.style.filter = `
    drop-shadow(0 0 6px rgba(${rgb},${alpha}))
    drop-shadow(0 0 12px rgba(${rgb},${alpha}))
    drop-shadow(0 0 18px rgba(${rgb},${alpha}))
    drop-shadow(0 0 24px rgba(${rgb},${alpha}))
  `;
}

    // Particles pour le shield
    if (zone === 'shield' && !document.hidden && !this.prefersReducedMotion) {
      if (!this.shieldActiveLast) {
        this.startParticles();
        this.shieldActiveLast = true;
      }
    } else {
      if (this.shieldActiveLast) {
        this.stopParticles();
        this.shieldActiveLast = false;
      }
    }

    this.layoutHalos();
  }

  public removeGlow(targetEl: HTMLElement) {
    const rec = this.haloMap.get(targetEl);
    if (rec) {
      rec.wrap.remove();
      this.haloMap.delete(targetEl);
    }
  }

  private startLifecycleListeners() {
    window.addEventListener('scroll', () => {
      requestAnimationFrame(() => this.layoutHalos());
    }, { passive: true });

    window.addEventListener('resize', () => {
      this.layoutHalos();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopParticles();
      }
    });
  }

  public destroy() {
    this.stopParticles();
    for (const rec of this.haloMap.values()) {
      rec.wrap.remove();
    }
    this.haloMap.clear();
  }
}

// Export singleton
export const healthGlow = new HealthGlowEffect();