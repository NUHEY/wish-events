import { requireManagement } from "@/lib/management-access";
import { getWishQuestions } from "@/lib/wish-knowledge";
import { getLocale } from "@/lib/i18n";
import { WishKnowledgeBoard } from "@/components/tools/wish-knowledge-board";

export default async function DashboardQuestionsPage() {
  const profile = await requireManagement("questions");
  const questions = await getWishQuestions();
  const en = await getLocale() === "en";
  const isRa = profile.role === "ra" && profile.account_kind === "resident";
  return <div className="mx-auto max-w-3xl space-y-4"><p className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">{isRa ? (en ? "Open a question to answer it or manage it. Private questions are visible only to their author and RAs." : "質問を開くと回答・管理できます。非公開の質問は投稿者本人とRAだけに表示されます。") : (en ? "You can review and delete public questions. RA-only questions and answers are reserved for RAs." : "公開質問の確認・削除ができます。RA限定の質問の閲覧・回答はRA専用です。")}</p><WishKnowledgeBoard initialQuestions={questions} currentName={profile.full_name} /></div>;
}
