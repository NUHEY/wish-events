
-- FOR ALL ポリシーはSELECTにも適用されるため、別途SELECT専用ポリシーが
-- あると「multiple permissive policies」として重複評価されてしまう。
-- ALLをINSERT/UPDATE/DELETEの3つに分割し、SELECTは既存の単一ポリシーに
-- is_ra()を統合することで、各操作につき常に1ポリシーだけが評価されるようにする。

drop policy if exists "registration_payments_manage_ra" on public.registration_payments;
create policy "registration_payments_insert_ra" on public.registration_payments
for insert with check (public.is_ra());
create policy "registration_payments_update_ra" on public.registration_payments
for update using (public.is_ra()) with check (public.is_ra());
create policy "registration_payments_delete_ra" on public.registration_payments
for delete using (public.is_ra());

drop policy if exists "registration_payments_select_own_or_ra" on public.registration_payments;
create policy "registration_payments_select" on public.registration_payments
for select using (
  public.is_ra()
  or exists (select 1 from public.registrations r where r.id = registration_payments.registration_id and r.user_id = (select auth.uid()))
);

drop policy if exists "survey_questions_manage_ra" on public.survey_questions;
create policy "survey_questions_insert_ra" on public.survey_questions
for insert with check (public.is_ra());
create policy "survey_questions_update_ra" on public.survey_questions
for update using (public.is_ra()) with check (public.is_ra());
create policy "survey_questions_delete_ra" on public.survey_questions
for delete using (public.is_ra());

drop policy if exists "survey_questions_select" on public.survey_questions;
create policy "survey_questions_select" on public.survey_questions
for select using (
  public.is_ra()
  or exists (select 1 from public.surveys s where s.id = survey_questions.survey_id and s.is_active)
);
