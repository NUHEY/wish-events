export default function EventDetailLoading() {
  return (
    <div className="mx-auto flex max-w-2xl animate-pulse flex-col gap-4">
      <div className="h-8 w-20 rounded-md bg-secondary" />
      <div className="aspect-[16/9] w-full rounded-2xl bg-secondary/70" />
      <div className="flex flex-col gap-2">
        <div className="h-7 w-3/4 rounded-md bg-secondary" />
        <div className="h-4 w-1/2 rounded-md bg-secondary/70" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-5 w-full rounded-md bg-secondary/70" />
        ))}
      </div>
      <div className="h-11 w-full rounded-xl bg-secondary" />
      <div className="h-24 w-full rounded-2xl bg-secondary/70" />
    </div>
  );
}
