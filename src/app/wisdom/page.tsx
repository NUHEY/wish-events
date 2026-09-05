import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getManagementAccess } from "@/lib/management-access";
import { canManage } from "@/lib/management-permissions";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { getWishQuestions } from "@/lib/wish-knowledge";
import { WishKnowledgeBoard } from "@/components/tools/wish-knowledge-board";

export default async function WisdomPage({ searchParams }: { searchParams: { ask?: string } }) {
  const profile = await getCurrentProfile();
  const access = await getManagementAccess();
  if ((await getFeatureFlagState("wish_knowledge")) === "hidden" && !canManage(access, "questions")) redirect("/tools");
  const questions = await getWishQuestions();
  return <div className="mx-auto max-w-3xl"><WishKnowledgeBoard initialQuestions={questions} currentName={profile.full_name} initialAskRa={searchParams.ask === "ra"} /></div>;
}
