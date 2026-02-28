import React, { useState, useEffect } from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  selected?: boolean;
};

export default function Card({
  selected = false,
  className = '',
  children,
  onClick,
  ...rest
}: CardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [justSelected, setJustSelected] = useState(false);

  useEffect(() => {
    if (selected) {
      setJustSelected(true);
      const timer = setTimeout(() => setJustSelected(false), 600);
      return () => clearTimeout(timer);
    }
  }, [selected]);

  return (
<div
  className={`relative rounded-xl cursor-pointer transition-all duration-200 ${
    isHovered && !selected ? 'transform scale-[1.02]' : ''
  } ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      {...rest}
    >
      {selected && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[2px] rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626, #b91c1c)',
              opacity: 0.9,
              animation: 'card-glow-pulse 2s ease-in-out infinite',
            }}
          />

          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[2px] rounded-xl"
            style={{
              boxShadow: `
                0 0 20px rgba(239, 68, 68, 0.4),
                0 0 40px rgba(239, 68, 68, 0.2),
                inset 0 0 20px rgba(239, 68, 68, 0.1)
              `,
              animation: 'card-shadow-pulse 2s ease-in-out infinite',
            }}
          />

          {justSelected && (
            <div
              className="pointer-events-none absolute -inset-[2px] rounded-xl"
              style={{
                background: 'radial-gradient(circle, rgba(239,68,68,0.5) 0%, transparent 70%)',
                animation: 'selection-burst 0.6s ease-out forwards',
              }}
            />
          )}
        </>
      )}

<div
  className={`relative z-10 h-full rounded-xl border-2 transition-all duration-200 flex flex-col ${
    selected
      ? 'border-transparent bg-gray-900/90'
      : 'border-amber-700/30 bg-gray-900/50 hover:border-amber-600/50 hover:bg-gray-900/70'
  }`}
>
        {children}
      </div>

      <style>{`
        @keyframes card-glow-pulse {
          0%, 100% {
            opacity: 0.7;
            filter: brightness(0.9);
          }
          50% {
            opacity: 1;
            filter: brightness(1.2);
          }
        }

        @keyframes card-shadow-pulse {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes selection-burst {
          0% {
            transform: scale(0.98);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.02);
            opacity: 0.4;
          }
          100% {
            transform: scale(1.05);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = '', ...rest } = props;
  return (
    <div
      className={`p-4 border-b border-gray-700/50 ${className}`}
      {...rest}
    />
  );
}

export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = '', ...rest } = props;
  return <div className={`p-4 flex-1 ${className}`} {...rest} />;
}
