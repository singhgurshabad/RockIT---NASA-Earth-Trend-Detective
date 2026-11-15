/**
 * RockIT mark: the Earth cut through like a rock sample, its layers showing,
 * with a trend line rising across it.
 */
export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <clipPath id="rockit-logo-clip"><circle cx="16" cy="16" r="12.5" /></clipPath>
        <linearGradient id="rockit-logo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d3a66" />
          <stop offset="1" stopColor="#0f2240" />
        </linearGradient>
      </defs>
      <g clipPath="url(#rockit-logo-clip)">
        <rect x="0" y="0" width="32" height="32" fill="url(#rockit-logo-sky)" />
        {/* rock layers */}
        <path d="M0 18.5 C 7 16.5, 12 19.5, 18 17.5 S 28 16, 32 17 V32 H0Z" fill="#2f8f6f" />
        <path d="M0 22 C 8 20.5, 14 23, 20 21.2 S 29 20.5, 32 21 V32 H0Z" fill="#c98a3c" />
        <path d="M0 25.5 C 7 24.5, 15 26.5, 22 25 S 29 24.5, 32 25 V32 H0Z" fill="#d9603b" />
      </g>
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="#6cc7e6" strokeWidth="1.6" />
      {/* the trend */}
      <path d="M6.5 19.5 L12.5 15 L16.5 17 L24.5 9.5" fill="none" stroke="#f4f7fb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.6 9.3 L24.7 9.3 L24.7 13.4" fill="none" stroke="#f4f7fb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
