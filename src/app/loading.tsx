// Shown instantly while a page's server data loads, so a tap on a phone gets
// visible feedback straight away instead of looking ignored.
export default function Loading() {
  return (
    <div className="flex flex-1 items-start justify-center px-4 py-24" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-line2 border-t-[var(--red)]" />
        <span className="font-mono text-[0.688rem] uppercase tracking-[0.2em]">Loading</span>
      </div>
    </div>
  );
}
