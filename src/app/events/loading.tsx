export default function EventsLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="h-8 w-40 rounded-md bg-secondary" />
        <div className="h-4 w-56 rounded-md bg-secondary/70" />
        <div className="h-9 w-full max-w-md rounded-full bg-secondary/70" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] rounded-xl bg-secondary/70" />
        ))}
      </div>
    </div>
  );
}
