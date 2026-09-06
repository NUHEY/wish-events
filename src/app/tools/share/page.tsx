import { requirePublishedTool } from "@/lib/tool-access";
import { ShareQrTool } from "@/components/tools/share-qr-tool";
export default async function SharePage() {
  await requirePublishedTool("share_qr");
  return <ShareQrTool />;
}
