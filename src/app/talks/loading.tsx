export default function TalksLoading() {
  return (
    <div className="mx-auto flex max-w-2xl animate-pulse flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-24 rounded-md bg-secondary" />
        <div className="h-4 w-64 rounded-md bg-secondary/70" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="h-14 w-14 rounded-xl bg-secondary/70" />
            <div className="flex-1">
              <div className="h-4 w-2/3 rounded-md bg-secondary/70" />
              <div className="mt-2 h-3 w-1/3 rounded-md bg-secondary/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
