export default function DashboardLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-40 rounded-md bg-secondary" />
        <div className="h-8 w-24 rounded-md bg-secondary/70" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-secondary/70" />
        ))}
      </div>
    </div>
  );
}
