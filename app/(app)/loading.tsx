export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-zinc-200" />
      <div className="mt-2 h-4 w-72 rounded bg-zinc-200" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-zinc-200" />
        ))}
      </div>
      <div className="mt-8 h-64 rounded-2xl bg-zinc-200" />
    </div>
  );
}
