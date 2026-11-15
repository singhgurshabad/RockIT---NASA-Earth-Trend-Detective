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
    <header className="topbar sticky top-0 z-40 backdrop-blur-md">
      <div className="flex h-[62px] w-full items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex flex-none items-center gap-2.5 text-ink no-underline" aria-label="RockIT home">
          <Logo size={38} />
          <span className="text-[21px] font-bold" style={{ fontStretch: "122%", letterSpacing: "-0.01em" }}>
            Rock<span className="brand-it">IT</span>
          </span>
        </Link>
        <nav aria-label="Pages" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:gap-2 sm:pl-4">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`nav-pill ${active ? "nav-pill-active" : ""}`}>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <p className="hidden flex-none items-center gap-2 rounded-full border border-line-strong px-3 py-1 text-[13px] text-ink-2 lg:flex" title={`${text}: ${API_URL}`} role="status">
          <span className="h-2 w-2 rounded-full" style={{ background: dot, boxShadow: status === "ready" ? "0 0 0 3px rgba(63,191,127,0.18)" : undefined }} aria-hidden="true" />
          {text}
        </p>
      </div>
    </header>
  );
}
