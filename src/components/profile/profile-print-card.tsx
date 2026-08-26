import Image from "next/image";
import { GraduationCap, Languages, Sparkles } from "lucide-react";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import type { ProfileShareData } from "@/components/profile/profile-share-modal";

/** html-to-imageで書き出す、実画面のマイページカードを再現した印刷専用表示。 */
export function ProfilePrintCard({ data }: { data: ProfileShareData }) {
  const accent = data.accentHex ?? "#7A2140";
  return (
    <div
      className="relative flex h-[1350px] w-[1080px] flex-col overflow-hidden bg-background text-foreground"
      style={{ fontFamily: "var(--font-noto-sans-jp), var(--font-inter), sans-serif" }}
    >
      <div className="relative h-[360px] shrink-0 overflow-hidden bg-secondary">
        {data.coverUrl ? (
          <Image src={data.coverUrl} alt="" fill sizes="1080px" unoptimized crossOrigin="anonymous" className="object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 45%, hsl(var(--background))))` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/25 to-transparent" />
      </div>

      <div className="flex flex-1 flex-col px-20 pb-16">
        <div className="-mt-28 flex items-end justify-between">
          <div className="h-56 w-56 overflow-hidden rounded-full border-[12px] border-card bg-secondary shadow-elevated">
            <Image src={data.avatarUrl || DEFAULT_AVATAR_IMAGE_URL} alt="" width={224} height={224} unoptimized crossOrigin="anonymous" className="h-full w-full object-cover" />
          </div>
          <span className="mb-5 rounded-full border border-border bg-card/90 px-6 py-3 text-2xl font-bold text-primary shadow-sm">WISH Events</span>
        </div>

        <div className="mt-8">
          <h2 className="text-6xl font-bold tracking-tight">{data.fullName || "WISH Resident"}</h2>
          <p className="mt-3 text-3xl text-muted-foreground">{data.roomText}</p>
        </div>

        <div className="mt-10 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card py-7 text-center shadow-card">
          <div><p className="text-5xl font-bold">{data.eventCount}</p><p className="mt-2 text-xl text-muted-foreground">EVENTS</p></div>
          <div><p className="text-5xl font-bold">{data.badges.length}</p><p className="mt-2 text-xl text-muted-foreground">BADGES</p></div>
          <div><p className="text-5xl font-bold">{data.surveyCount}</p><p className="mt-2 text-xl text-muted-foreground">SURVEYS</p></div>
        </div>

        {(data.faculty || data.gradeLevel) && <div className="mt-8 flex flex-wrap gap-4">{data.faculty && <span className="inline-flex items-center gap-3 rounded-2xl bg-violet-100 px-5 py-3 text-2xl font-semibold text-violet-900"><GraduationCap className="h-7 w-7" />{data.faculty}</span>}{data.gradeLevel && <span className="inline-flex items-center gap-3 rounded-2xl bg-amber-100 px-5 py-3 text-2xl font-semibold text-amber-900"><Sparkles className="h-7 w-7" />{data.gradeLevel}</span>}</div>}

        {data.languages.length > 0 && <div className="mt-7 flex flex-wrap gap-3">{data.languages.slice(0, 6).map((language, index) => <span key={language} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xl font-semibold ${index % 2 === 0 ? "bg-sky-100 text-sky-900" : "bg-emerald-100 text-emerald-900"}`}><Languages className="h-5 w-5" />{language}</span>)}</div>}

        {data.selfIntro && <p className="mt-8 line-clamp-4 whitespace-pre-wrap text-2xl leading-relaxed text-foreground/80">{data.selfIntro}</p>}

        {data.badges.length > 0 && <div className="mt-auto flex flex-wrap gap-4 border-t border-border pt-8">{data.badges.slice(0, 6).map((badge) => <span key={badge.label} className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xl font-semibold"><span>{badge.icon}</span>{badge.label}</span>)}</div>}
      </div>
    </div>
  );
}
