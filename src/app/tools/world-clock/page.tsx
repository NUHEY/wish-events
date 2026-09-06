import { requirePublishedTool } from "@/lib/tool-access";
import { EverydayTool } from "@/components/tools/everyday-tools";
export default async function Page() { await requirePublishedTool("world_clock"); return <EverydayTool kind="world-clock" />; }
