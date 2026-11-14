export default function Header({ onHome }: { onHome: () => void }) {
  return (
    <header className="relative z-50 flex flex-wrap items-center justify-between gap-3 bg-page px-6 py-2.5">
      <h1 className="m-0 text-[clamp(32px,5vw,60px)]">
        <button onClick={onHome} aria-label="Back to landing page" className="text-ink hover:opacity-75">
          rockIT
        </button>
      </h1>
      <nav className="flex flex-wrap gap-4">
        {["About", "Methods", "Team"].map((label) => (
          <button
            key={label}
            className="rounded-xl bg-btn px-7 py-3 text-lg text-ink transition hover:-translate-y-0.5 hover:bg-btn-hover"
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
