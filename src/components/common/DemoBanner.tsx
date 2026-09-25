export function DemoBanner() {
  const message = import.meta.env.VITE_DEMO_BANNER?.trim();
  if (!message) return null;

  return (
    <div role="status" className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-center text-[11px] font-medium text-amber-200">
      {message}
    </div>
  );
}

export default DemoBanner;
