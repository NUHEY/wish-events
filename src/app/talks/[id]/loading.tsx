export default function TalkRoomLoading() {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background sm:static sm:mx-auto sm:max-w-2xl sm:gap-4">
      <div className="flex animate-pulse items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:rounded-t-2xl">
        <div className="h-8 w-8 rounded-md bg-secondary" />
        <div className="h-10 w-10 rounded-full bg-secondary/70" />
        <div className="flex-1">
          <div className="h-4 w-1/2 rounded-md bg-secondary/70" />
          <div className="mt-1.5 h-3 w-1/4 rounded-md bg-secondary/50" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 animate-pulse flex-col justify-end gap-3 bg-[#f8f7f8] px-3.5 py-5">
        <div className="h-10 w-2/3 max-w-[75%] rounded-2xl bg-secondary/60" />
        <div className="ml-auto h-10 w-1/2 max-w-[75%] rounded-2xl bg-secondary/70" />
        <div className="h-10 w-3/5 max-w-[75%] rounded-2xl bg-secondary/60" />
      </div>
    </div>
  );
}
