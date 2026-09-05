import { getCurrentProfile } from "@/lib/auth";
import { ShareQrTool } from "@/components/tools/share-qr-tool";
export default async function SharePage() {
  await getCurrentProfile();
  return <ShareQrTool />;
}
