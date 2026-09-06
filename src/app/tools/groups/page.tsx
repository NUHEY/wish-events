import { requirePublishedTool } from "@/lib/tool-access";
import { EverydayTool } from "@/components/tools/everyday-tools";
export default async function Page() { await requirePublishedTool("group_shuffle"); return <EverydayTool kind="groups" />; }
