import type { CSSProperties } from "react";
const paths: Record<string, React.ReactNode> = {
 arrow: <><path d="M5 19 19 5M5 5h14v14"/></>,
 globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></>,
 thermometer: <><path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M12 8v9"/><circle cx="12" cy="18" r="1"/></>,
 "cloud-rain": <><path d="M6 14a4 4 0 0 1-1-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 2 9H6Z"/><path d="m8 17-1 4m6-4-1 4m6-4-1 4"/></>,
 sprout: <><path d="M12 22V11C6 12 3 8 3 3c6 0 9 3 9 8 0-5 3-7 9-7 0 6-3 9-9 9"/></>,
 droplets: <><path d="M12 3C9 8 5 11 5 15a7 7 0 0 0 14 0c0-4-4-7-7-12Z"/><path d="M9 15a3 3 0 0 0 3 3"/></>,
 download: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></>,
 play: <path d="m8 5 11 7-11 7V5Z"/>,
 check: <path d="m5 12 4 4L19 6"/>,
 layers: <><path d="m12 3 10 6-10 6L2 9l10-6Zm-9 11 9 5 9-5M3 18l9 5 9-5"/></>,
};
export default function Icon({ name, size = 19, style }: { name: string; size?: number; style?: CSSProperties }) {
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">{paths[name] ?? paths.globe}</svg>;
}
