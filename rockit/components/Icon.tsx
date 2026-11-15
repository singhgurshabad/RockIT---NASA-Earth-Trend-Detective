// One small icon set, drawn on a 24px grid with a 1.6px stroke, so every icon in the app matches.

const PATHS: Record<string, React.ReactNode> = {
  thermometer: <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0ZM12 9v7" />,
  "cloud-rain": <path d="M7 15a4 4 0 0 1 .7-7.9A5.5 5.5 0 0 1 18.3 9 3.5 3.5 0 0 1 17.5 15M8.5 18.5l-.8 2M12.4 18.5l-.8 2M16.3 18.5l-.8 2" />,
  sprout: <path d="M12 21v-9M12 12c0-3.5-2.5-6-6.5-6C5.5 9.8 8 12 12 12ZM12 14c0-3 2-5 6-5 0 3.3-2 5-6 5ZM7 21h10" />,
  droplets: <path d="M8.5 4.5c2 2.6 3.5 4.6 3.5 6.6a3.5 3.5 0 0 1-7 0c0-2 1.500-4 3.500-6.600ZM16 10.500c1.800 2.300 3 4 3 5.700a3 3 0 0 1-6 0c0-1.700 1.200-3.400 3-5.700Z" />,
  play: <path d="M8 5.5v13l10.500-6.500L8 5.500Z" />,
  stop: <path d="M7 7h10v10H7z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.500 4.500L19 7.500" />,
  alert: <path d="M12 4 2.800 19.500h18.400L12 4ZM12 10v4.500M12 17.200v.300" />,
  info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.500M12 7.700v.300" />,
  download: <path d="M12 4v11M7.500 10.500 12 15l4.500-4.500M5 19.500h14" />,
  retry: <path d="M19.500 12a7.500 7.500 0 1 1-2.400-5.500M19.500 4v4.500H15" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  flat: <path d="M5 12h14" />,
  globe: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.500 2.500 3.800 5.500 3.800 9s-1.300 6.500-3.800 9c-2.500-2.500-3.800-5.500-3.800-9S9.500 5.500 12 3Z" />,
  twin: <path d="M8.500 15.500a4.500 4.500 0 1 0 0-9 4.500 4.500 0 0 0 0 9ZM15.500 17.500a4.500 4.500 0 1 0 0-9 4.500 4.500 0 0 0 0 9Z" />,
  layers: <path d="m12 4 8.500 4.500L12 13 3.500 8.500 12 4ZM3.500 12.500 12 17l8.500-4.500M3.500 16.500 12 21l8.500-4.500" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5.500l3.500 2" />,
  trash: <path d="M5 7h14M10 7V4.500h4V7M7 7l.800 12.500h8.400L17 7M10.500 10.500v6M13.500 10.500v6" />,
  table: <path d="M4 5.500h16v13H4zM4 10h16M4 14.500h16M9.500 5.500v13" />,
  target: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 15.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7Z" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  external: <path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5" />,
  reset: <path d="M4.500 12a7.500 7.500 0 1 0 2.400-5.500M4.500 4v4.500H9" />,
};

export default function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name] ?? PATHS.info}
    </svg>
  );
}
