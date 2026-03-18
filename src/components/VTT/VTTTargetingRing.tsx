import React from 'react';

interface VTTTargetingRingProps {
  /** Taille du token en pixels (= gridSize de ta config) */
  size: number;
  /** Couleur de l'anneau externe (optionnel, défaut blanc) */
  color?: string;
  /** Couleur de l'anneau interne (optionnel, défaut rouge) */
  colorInner?: string;
}

/**
 * Anneau de ciblage ésotérique à superposer sur un token VTT.
 *
 * Usage dans ton canvas/renderer de tokens :
 *
 *   {(token.targetedByUserIds ?? []).length > 0 && (
 *     <VTTTargetingRing size={config.gridSize} />
 *   )}
 *
 * Place ce composant en position absolute par-dessus l'image du token,
 * centré avec top/left à 50% et transform translate(-50%, -50%).
 */
export function VTTTargetingRing({
  size,
  color = '#ffffff',
  colorInner = '#e24b4a',
}: VTTTargetingRingProps) {
  const half = size / 2;

  // Rayons des deux anneaux, collés autour du token
  const rOuter = half + size * 0.22;  // ~22% du rayon au-delà du token
  const rInner = half + size * 0.10;  // ~10% du rayon au-delà du token

  const cx = half;
  const cy = half;
  const vb = size;

  // Chemins circulaires pour textPath (le cercle doit être tracé en 2 demi-arcs)
  const outerPath = `M ${cx - rOuter},${cy} a ${rOuter},${rOuter} 0 1,1 ${rOuter * 2},0 a ${rOuter},${rOuter} 0 1,1 -${rOuter * 2},0`;
  const innerPath = `M ${cx - rInner},${cy} a ${rInner},${rInner} 0 1,1 ${rInner * 2},0 a ${rInner},${rInner} 0 1,1 -${rInner * 2},0`;

  // Taille de fonte adaptée à la taille du token
  const fontSizeOuter = Math.max(6, size * 0.115);
  const fontSizeInner = Math.max(5, size * 0.100);

  // Texte très long pour remplir sans trous
  const runeText = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'.repeat(8);
  const esotericText = '☽✧⊕✦⊗☿⊙⊘△✶'.repeat(12);

  const idSuffix = React.useId().replace(/:/g, '');

  return (
    <svg
      width={vb}
      height={vb}
      viewBox={`0 0 ${vb} ${vb}`}
      style={{ overflow: 'visible', pointerEvents: 'none' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>{`
          @keyframes vtt-spin-cw  { to { transform: rotate(360deg);  } }
          @keyframes vtt-spin-ccw { to { transform: rotate(-360deg); } }
          @keyframes vtt-blink    { 0%,100%{opacity:1} 50%{opacity:.1} }
          @keyframes vtt-pulse    { 0%,100%{opacity:.45} 50%{opacity:.05} }

          .vtt-ring-cw-${idSuffix}  {
            animation: vtt-spin-cw  8s linear infinite;
            transform-origin: ${cx}px ${cy}px;
          }
          .vtt-ring-ccw-${idSuffix} {
            animation: vtt-spin-ccw 6s linear infinite;
            transform-origin: ${cx}px ${cy}px;
          }
          .vtt-blink-${idSuffix}  { animation: vtt-blink 0.9s ease-in-out infinite; }
          .vtt-pulse-${idSuffix}  { animation: vtt-pulse 2s ease-in-out infinite; }
        `}</style>

        <path id={`outer-${idSuffix}`} d={outerPath} />
        <path id={`inner-${idSuffix}`} d={innerPath} />
      </defs>

      {/* Halo pulsant */}
      <circle
        className={`vtt-pulse-${idSuffix}`}
        cx={cx} cy={cy} r={rOuter + size * 0.04}
        fill="none" stroke={color} strokeWidth="0.8" opacity="0.5"
      />

      {/* Anneau externe — runes futhark — sens horaire */}
      <g className={`vtt-ring-cw-${idSuffix}`}>
        <text
          fontSize={fontSizeOuter}
          fill={color}
          fontFamily="Georgia, serif"
          opacity="0.92"
          letterSpacing="0.2"
        >
          <textPath href={`#outer-${idSuffix}`}>{runeText}</textPath>
        </text>
      </g>

      {/* Anneau interne — symboles ésotériques — sens anti-horaire */}
      <g className={`vtt-ring-ccw-${idSuffix}`}>
        <text
  fontSize={fontSizeInner}
  fill="#ffffff"
  fontFamily="Georgia, serif"
  opacity="0.88"
  letterSpacing="0.3"
        >
          <textPath href={`#inner-${idSuffix}`}>{esotericText}</textPath>
        </text>
      </g>

      {/* Point central clignotant */}
      <circle
        className={`vtt-blink-${idSuffix}`}
        cx={cx} cy={cy} r={Math.max(2, size * 0.04)}
        fill={color}
      />
    </svg>
  );
}
