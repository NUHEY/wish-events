import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseFullRoomNumber } from "@/lib/validations/profile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ResidentManager } from "@/components/dashboard/resident-manager";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRa();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  let residents: any[] = [];

  if (query) {
    const room = parseFullRoomNumber(query);
    if (room) {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("floor_number", room.floorNumber)
        .eq("room_number", room.roomNumber)
        .order("full_name", { ascending: true });
      residents = data ?? [];
    } else {
      const { data } = await supabase
        .from("users")
        .select("*")
        .or(
          `full_name.ilike.%${query}%,email.ilike.%${query}%,student_id.ilike.%${query}%,room_number.ilike.%${query}%`
        )
        .order("full_name", { ascending: true })
        .limit(50);
      residents = data ?? [];
    }
  } else {
    const { data } = await supabase
      .from("users")
      .select("*")
      .not("floor_number", "is", null)
      .order("updated_at", { ascending: false })
      .limit(30);
    residents = data ?? [];
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{dict.residents.title}</h1>
        <p className="text-sm text-muted-foreground">
          {dict.residents.subtitle}
        </p>
      </div>

      <form className="flex gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={dict.residents.searchPlaceholder}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline" size="sm">
          {dict.residents.searchButton}
        </Button>
      </form>

      {!query && (
        <p className="text-xs text-muted-foreground">
          {dict.residents.defaultListNote}
        </p>
      )}

      <ResidentManager residents={residents} />
    </div>
  );
}
