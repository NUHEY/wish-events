# WISH Events - セットアップ & 実装メモ (v2)

対象: 早稲田大学国際学生寮「WISH」イベント管理サイト
スタック: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase + Vercel

このZIPには実装済みのコード一式（`src/`）と `supabase/schema.sql` が含まれています。
`npm install` すれば手元でそのまま動かせる状態です。

---

## v2 で追加した内容（前回のご要望への対応）

1. **10〜11階対応**: プロフィール登録画面を「階（3〜11階のセレクトボックス）」と「部屋番号（号室のみ）」の2項目に分離しました。DBも `users.floor_number`（整数） + `users.room_number`（号室のみの文字列）に分割しています。表示時は `formatRoomNumber()` で結合して "301A" のように表示します。
2. **フロア限定配信**: イベント作成・編集フォームに「配信対象フロア」チェックボックス（3〜11階）を追加しました。例えば3階と11階だけにチェックすると、その階の寮生の一覧・詳細画面にだけそのイベントが表示されます（未選択=全フロア対象、RAは常に全件見えます）。DBの`events.target_floors`とRLSで制御しているため、フロント側の実装ミスでは漏れません。
3. **RA間の編集権限**: 「作成したRA本人のみ」から「RAなら誰でも全イベント・全アンケートを編集・削除できる」に変更しました（`events`/`surveys`/`registrations`のRLSを更新）。
4. **参加者一覧のCSVダウンロード**: 管理ダッシュボードの参加者一覧画面に「CSVダウンロード」ボタンを実装しました（Excelで文字化けしないようUTF-8 BOM付き）。
5. **イベント後アンケート（外部 / サイト内蔵の両対応）**:
   - イベント作成・編集フォームで「なし / 外部フォーム(Google フォーム等のURL) / サイト内蔵アンケート」を選択できます。
   - サイト内蔵を選ぶと、管理ダッシュボードの「アンケート管理」画面で質問（自由記述・単一選択・複数選択・5段階評価）を自由に追加できます。
   - 寮生側は、参加したイベントが終了しかつ未回答のアンケートがあると、ホーム画面上部にバナーで一覧表示され、ワンクリックで回答画面（内蔵アンケート）または外部フォームへ遷移できます（「アンケートに回答する」ボタン）。
   - 制約: 外部フォームは寮生が実際に回答したかをこのサイト側では検知できないため、回答済みでも当面バナーには出続けます。この点は次のステップで「回答した」を自己申告できるボタンを足す等の改善が可能です。

---

## 動作確認済みの内容

- `npm install` → `npx tsc --noEmit`（型エラー0件）
- `npx next build`（ビルド成功、全12ルートが正常にコンパイル）

を実際にこのサンドボックス内で実行し、確認しています。ただし実際のSupabaseプロジェクトに接続してのE2E動作確認（ログイン〜申込〜アンケート回答まで）はまだ行っていないため、初回セットアップ後は一通り手動で動作確認してください。

---

## 1. セットアップ手順

```bash
cd wish-events
npm install
cp .env.local.example .env.local
# .env.local に Supabase の URL / anon key を設定
npm run dev
```

### Supabase側の準備

1. https://supabase.com で新規プロジェクトを作成（Freeプラン）
2. Authentication → Providers → Google を有効化し、Google Cloud Console で発行したOAuthクライアントID/シークレットを設定
3. Authentication → URL Configuration の Redirect URLs に追加
   - `http://localhost:3000/auth/callback`（開発用）
   - `https://<your-vercel-domain>/auth/callback`（本番用）
4. SQL Editor で `supabase/schema.sql` を上から実行
5. デプロイ後、RAにしたいユーザーが初回ログインした後、SQL Editorから昇格
   ```sql
   update public.users set role = 'ra' where email = 'xxxx@toki.waseda.jp';
   ```

### Vercelへのデプロイ

```bash
npm install -g vercel
vercel
```

Vercel の Project Settings → Environment Variables に `.env.local` と同じ2つの変数（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`）を登録してください。

---

## 2. 使用パッケージ（package.jsonに反映済み）

- `next` 14.2.35 / `react` 18 / `typescript` 5
- `@supabase/supabase-js` 2.45.4, `@supabase/ssr` 0.5.2（**バージョン固定**。最新版はSupabase-jsの型システムが大きく変わっており、本プロジェクトの簡易型定義と相性が悪かったため、動作確認済みのこのバージョンに固定しています。将来アップグレードする場合は `src/types/database.ts` をSupabase CLIの正式な生成型に置き換えてから行ってください）
- `react-hook-form` / `zod`（バリデーション基盤。現状はServer Actions + zodのシンプルな構成で、react-hook-formは今後フォームを高度化する際の土台として同梱）
- `react-markdown` + `remark-gfm`（イベント詳細のMarkdown表示・プレビュー。当初案にあった `@uiw/react-md-editor` は依存を減らすため不採用とし、テキストエリア+プレビュー切替のシンプルな構成にしました）
- `date-fns`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`

### UIコンポーネントについて
`src/components/ui/` は shadcn/ui 風のTailwindコンポーネントですが、Radix UIには依存せずネイティブHTML要素（`<select>`, `<input type="checkbox">`等）ベースで実装しています。依存を減らし確実に動く状態を優先した判断です。将来的に `npx shadcn@latest add <name>` で正式なRadixベースのコンポーネントに差し替えることも可能です。

---

## 3. ディレクトリ構成（実装済み）

```
wish-events/
├── src/
│   ├── app/
│   │   ├── layout.tsx                       # ルートレイアウト（Header含む）
│   │   ├── page.tsx                         # イベント一覧 + アンケート未回答バナー
│   │   ├── globals.css
│   │   ├── login/page.tsx                   # ログイン画面
│   │   ├── auth/callback/route.ts           # OAuthコールバック
│   │   ├── profile/setup/page.tsx           # 初回プロフィール登録
│   │   ├── events/
│   │   │   ├── [id]/page.tsx                # イベント詳細
│   │   │   ├── [id]/edit/page.tsx           # イベント編集（RA専用）
│   │   │   ├── [id]/survey/page.tsx         # 寮生向けアンケート回答画面
│   │   │   └── new/page.tsx                 # イベント作成（RA専用）
│   │   └── dashboard/
│   │       ├── page.tsx                     # RA管理ダッシュボード（全イベント一覧）
│   │       ├── [id]/participants/page.tsx   # 参加者一覧 + CSVダウンロード
│   │       └── [id]/survey/page.tsx         # アンケート管理（質問作成・受付停止）
│   │
│   ├── components/
│   │   ├── ui/                              # 軽量UIプリミティブ
│   │   ├── events/                          # event-card / event-filter / event-form / registration-button
│   │   ├── participants/participant-table.tsx
│   │   ├── surveys/                         # survey-builder / survey-response-form / pending-survey-banner / survey-active-toggle
│   │   ├── layout/                          # header / nav / sign-out-button
│   │   └── auth/profile-form.tsx
│   │
│   ├── lib/
│   │   ├── supabase/{client,server,middleware}.ts
│   │   ├── validations/{profile,event,survey}.ts
│   │   ├── auth.ts                          # getCurrentProfile() / requireRa()
│   │   ├── constants.ts                     # カテゴリ・フロア一覧・アンケート質問種別
│   │   └── utils.ts                         # cn() / CSV変換 / 日時整形
│   │
│   ├── actions/                             # Server Actions
│   │   ├── profile.ts / events.ts / registrations.ts / surveys.ts
│   │
│   ├── types/database.ts                    # 簡易DB型（要:本番前にSupabase CLIで再生成）
│   └── middleware.ts
│
├── supabase/schema.sql
├── public/
├── .env.local.example
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```

---

## 4. 今のうちに確認しておきたい点

1. **`src/types/database.ts` は手書きの簡易型です。** Supabase CLIをセットアップしたら
   ```bash
   npx supabase login
   npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
   ```
   で正式な型に置き換えてください（クエリの型安全性が上がります）。

2. **アンケートの「回答済み判定」は内蔵アンケートのみ正確です。** 外部フォーム（Googleフォーム）の場合、回答済みかどうかをこのサイト側で知る手段がないため、ホーム画面のバナーには回答後も表示され続けます。気になるようであれば、「回答しました」ボタンを追加して `survey_responses` 的な自己申告レコードを作る改善を次のステップでできます。

3. **イベントの公開範囲は「フロア」のみです。** 現状は3〜11階のフロア単位でしか絞り込めません。将来「新入寮生のみ」「特定ユニットのみ」等さらに細かい絞り込みが必要になった場合は教えてください。

4. **RAは全イベント・全アンケートを編集・削除できます。** 誰が何を変更したかの変更履歴（監査ログ）は現状ありません。必要であれば `events`/`surveys` に簡単な変更履歴テーブルを追加できます。

---

追加でご要望があれば、遠慮なく教えてください。次に実装したい機能や気になる点があれば、そのまま書いていただければ反映していきます。
