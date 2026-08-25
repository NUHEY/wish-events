export default function DirectoryLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-40 rounded-md bg-secondary" />
        <div className="h-4 w-64 rounded-md bg-secondary/70" />
      </div>
      <div className="h-10 w-full rounded-md bg-secondary/70" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-secondary/70" />
        ))}
      </div>
    </div>
  );
}
