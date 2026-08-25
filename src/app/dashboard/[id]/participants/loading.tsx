export default function ParticipantsLoading() {
  return (
    <div className="mx-auto flex max-w-4xl animate-pulse flex-col gap-4">
      <div className="h-8 w-20 rounded-md bg-secondary" />
      <div className="h-7 w-1/2 rounded-md bg-secondary" />
      <div className="h-9 w-full max-w-sm rounded-full bg-secondary/70" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 w-full rounded-xl bg-secondary/70" />
        ))}
      </div>
    </div>
  );
}
