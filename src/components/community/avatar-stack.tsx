import Image from "next/image";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";

type Participant = { id: string; full_name: string | null; avatar_url: string | null; role: string };

const MAX_VISIBLE = 7;

/** イベントトークの参加者アイコンを半分重ねて表示する（最大7人＋他n人）。 */
export function AvatarStack({ participants, total }: { participants: Participant[]; total: number }) {
  const visible = participants.slice(0, MAX_VISIBLE);
  const overflow = total - visible.length;

  return (
    <div className="flex shrink-0 items-center -space-x-2.5">
      {visible.map((p) => (
        <AvatarRing key={p.id} role={p.role} size={26} className="ring-2 ring-card">
          <Image src={p.avatar_url || DEFAULT_AVATAR_IMAGE_URL} alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-full object-cover" />
        </AvatarRing>
      ))}
      {overflow > 0 && (
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-card">
          +{overflow}
        </span>
      )}
    </div>
  );
}
