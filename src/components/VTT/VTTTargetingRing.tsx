import React from 'react';

interface VTTTargetingRingProps {
  /** Taille du token en pixels (= gridSize de ta config) */
  size: number;
  /** Couleur de l'anneau externe (optionnel, défaut blanc) */
  color?: string;
  /** Couleur de l'anneau interne (optionnel, défaut rouge) */
  colorInner?: string;
}

export function VTTTargetingRing({
  size,
  color = '#ffffff',
  colorInner = '#e24b4a',
}: VTTTargetingRingProps) {
  const half = size / 2;

  const rOuter = half + size * 0.22;
  const rInner = half + size * 0.10;

  const cx = half;
  const cy = half;
  const vb = size;

  const outerPath = `M ${cx - rOuter},${cy} a ${rOuter},${rOuter} 0 1,1 ${rOuter * 2},0 a ${rOuter},${rOuter} 0 1,1 -${rOuter * 2},0`;
  const innerPath = `M ${cx - rInner},${cy} a ${rInner},${rInner} 0 1,1 ${rInner * 2},0 a ${rInner},${rInner} 0 1,1 -${rInner * 2},0`;

  const fontSizeOuter = Math.max(6, size * 0.115);
  const fontSizeInner = Math.max(5, size * 0.100);

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

          .vtt-ring-cw-${idSuffix}  {
            animation: vtt-spin-cw  8s linear infinite;
            transform-origin: ${cx}px ${cy}px;
          }
          .vtt-ring-ccw-${idSuffix} {
            animation: vtt-spin-ccw 6s linear infinite;
            transform-origin: ${cx}px ${cy}px;
          }
          .vtt-blink-${idSuffix} { animation: vtt-blink 0.9s ease-in-out infinite; }
        `}</style>

        <path id={`outer-${idSuffix}`} d={outerPath} />
        <path id={`inner-${idSuffix}`} d={innerPath} />
      </defs>

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
