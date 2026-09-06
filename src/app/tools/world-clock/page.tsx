import { getCurrentProfile } from "@/lib/auth";
import { EverydayTool } from "@/components/tools/everyday-tools";
export default async function Page() { await getCurrentProfile(); return <EverydayTool kind="world-clock" />; }
