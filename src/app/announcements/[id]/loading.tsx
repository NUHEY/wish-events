export default function AnnouncementDetailLoading() {
  return (
    <div className="mx-auto flex max-w-2xl animate-pulse flex-col gap-5">
      <div className="h-5 w-16 rounded-md bg-secondary/70" />
      <div className="aspect-[16/9] w-full rounded-2xl bg-secondary/70" />
      <div className="flex flex-col gap-2">
        <div className="h-6 w-1/2 rounded-md bg-secondary" />
        <div className="h-3.5 w-32 rounded-md bg-secondary/70" />
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="h-4 w-full rounded bg-secondary/70" />
        <div className="h-4 w-full rounded bg-secondary/70" />
        <div className="h-4 w-3/4 rounded bg-secondary/70" />
      </div>
    </div>
  );
}
