export default function DirectoryProfileLoading() {
  return (
    <div className="mx-auto flex max-w-xl animate-pulse flex-col gap-4">
      <div className="h-5 w-16 rounded-md bg-secondary/70" />

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 rounded-full bg-secondary" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="h-5 w-32 rounded-md bg-secondary" />
              <div className="h-3.5 w-20 rounded-md bg-secondary/70" />
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border py-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="h-4 w-6 rounded bg-secondary" />
                <div className="h-2.5 w-10 rounded bg-secondary/70" />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-6 w-16 rounded-full bg-secondary/70" />
            ))}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="h-3 w-24 rounded bg-secondary/70" />
            <div className="h-4 w-full rounded bg-secondary/70" />
            <div className="h-4 w-4/5 rounded bg-secondary/70" />
          </div>
        </div>
      </div>
    </div>
  );
}
