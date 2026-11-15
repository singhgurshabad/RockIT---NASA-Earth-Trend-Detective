"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { API_URL } from "@/lib/api";
import { useAppData } from "./AppData";
import Logo from "./Logo";

const LINKS = [
  { href: "/", label: "Explore" },
  { href: "/discover", label: "Discover" },
  { href: "/method", label: "Method" },
];

export default function TopBar() {
  const pathname = usePathname();
  const { boot } = useAppData();
  const status = boot.status;
  const text = status === "ready" ? "Data service connected" : status === "loading" ? "Connecting to the data service" : "Data service unreachable";
  const dot = status === "ready" ? "#3fbf7f" : status === "loading" ? "#7f8fa9" : "#e66767";
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[rgba(4,7,13,0.86)] backdrop-blur-md">
      <div className="page flex h-[60px] items-center gap-2 sm:gap-5">
        <Link href="/" className="flex flex-none items-center gap-2.5 text-ink no-underline" aria-label="RockIT home">
          <Logo />
          <span className="text-[19px] font-bold" style={{ fontStretch: "122%", letterSpacing: "-0.01em" }}>
            Rock<span style={{ color: "var(--accent)" }}>IT</span>
          </span>
        </Link>
        <nav aria-label="Pages" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] sm:gap-1">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className="relative whitespace-nowrap rounded-md px-2 py-2 text-[14px] font-medium sm:px-3 sm:text-[14.5px] no-underline transition-colors hover:bg-raised hover:text-ink"
                style={{ color: active ? "var(--ink)" : "var(--ink-2)" }}
              >
                {link.label}
                {active && <span className="absolute inset-x-2 -bottom-[11px] sm:inset-x-3 h-[2px] rounded-full" style={{ background: "var(--accent)" }} aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>
        <p className="hidden flex-none items-center gap-2 text-[13px] text-ink-3 lg:flex" title={`${text}: ${API_URL}`} role="status">
          <span className="h-2 w-2 rounded-full" style={{ background: dot, boxShadow: status === "ready" ? "0 0 0 3px rgba(63,191,127,0.18)" : undefined }} aria-hidden="true" />
          {text}
        </p>
      </div>
    </header>
  );
}
