export default function HomeLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-8">
      <div className="flex flex-col gap-2 border-b border-border pb-6">
        <div className="h-8 w-48 rounded-md bg-secondary" />
        <div className="h-4 w-64 rounded-md bg-secondary/70" />
      </div>
      {[0, 1, 2].map((section) => (
        <div key={section} className="flex flex-col gap-3">
          <div className="h-5 w-32 rounded-md bg-secondary" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[4/5] rounded-xl bg-secondary/70" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
