export default function NotificationsLoading() {
  return (
    <div className="mx-auto flex max-w-2xl animate-pulse flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="h-5 w-10 rounded-md bg-secondary/70" />
        <div className="h-6 w-16 rounded-md bg-secondary" />
      </div>
      <div className="flex flex-col divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <div className="h-11 w-11 shrink-0 rounded-full bg-secondary/70" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3.5 w-3/4 rounded bg-secondary/70" />
              <div className="h-3 w-1/3 rounded bg-secondary/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
