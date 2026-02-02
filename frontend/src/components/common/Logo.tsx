import React from 'react';

const LogoSVG: React.FC<{ size: number, className: string }> = ({ size, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Outer ring with gradient */}
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0ea5e9" />
        <stop offset="50%" stopColor="#0284c7" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
      <linearGradient id="innerGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#0ea5e9" />
      </linearGradient>
    </defs>

    {/* Background circle */}
    <circle
      cx="16"
      cy="16"
      r="15"
      fill="url(#logoGradient)"
      stroke="rgba(255,255,255,0.2)"
      strokeWidth="1"
    />

    {/* Inner glow effect */}
    <circle
      cx="16"
      cy="16"
      r="12"
      fill="url(#innerGlow)"
      opacity="0.3"
    />

    {/* Chat bubble icon */}
    <g transform="translate(8, 8)">
      {/* Main bubble */}
      <path
        d="M8 2C6.89543 2 6 2.89543 6 4V10C6 11.1046 6.89543 12 8 12H10L14 16V12H16C17.1046 12 18 11.1046 18 10V4C18 2.89543 17.1046 2 16 2H8Z"
        fill="white"
        stroke="url(#logoGradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* AI indicator dots */}
      <circle cx="9" cy="6" r="1" fill="url(#logoGradient)" />
      <circle cx="12" cy="6" r="1" fill="url(#logoGradient)" />
      <circle cx="15" cy="6" r="1" fill="url(#logoGradient)" />

      {/* Response indicator */}
      <path
        d="M9 9L11 11L15 7"
        stroke="url(#logoGradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </g>
  </svg>
);

interface LogoProps {
  size?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 32, className = '' }) => {
  return <LogoSVG size={size} className={className} />;
};

export default React.memo(Logo);
