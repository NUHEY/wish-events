import { TalkSelectionGuard } from "@/components/community/talk-selection-guard";

export default function TalksLayout({ children }: { children: React.ReactNode }) {
  return <TalkSelectionGuard>{children}</TalkSelectionGuard>;
}
