export default function ProfileEditLoading() {
  return (
    <div className="mx-auto flex max-w-md animate-pulse flex-col gap-3">
      <div className="h-5 w-16 self-start rounded-md bg-secondary/70" />
      <div className="rounded-xl border border-border p-5">
        <div className="mb-5 flex flex-col gap-2">
          <div className="h-5 w-28 rounded-md bg-secondary" />
          <div className="h-3.5 w-48 rounded-md bg-secondary/70" />
        </div>
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-3 w-20 rounded bg-secondary/70" />
              <div className="h-10 w-full rounded-md bg-secondary/70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
