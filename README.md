# WISH Events

早稲田大学国際学生寮WISHのイベント、お知らせ、参加申込、イベントトーク、アンケート、集金確認をまとめて管理するWebアプリです。一般寮生はスマホ中心、RAはスマホ・パソコンの両方から利用できます。

## 主な機能

- イベント・お知らせの作成、公開、編集
- イベント申込、定員、事前質問、参加者CSV
- イベントごとのトーク、画像、投票、アンケート、リアクション
- コメント、返信、いいね、RAプロフィールリング
- 集金予定、支払い先、RAによる手動入金確認
- 寮生ディレクトリ、プロフィール、SNS、LINE QR
- RA・寮生・部屋・バッジ・ホーム画面の管理
- 友達DMの段階公開（公開・BETA・非公開）
- 日本語・英語表示

## 使用技術

- Next.js 14 / React 18 / TypeScript
- Tailwind CSS / Radix UI / Lucide Icons
- Supabase Authentication / PostgreSQL / Storage / Realtime
- Vercel Speed Insights
- FormKit AutoAnimate

## ローカルで起動する

### 1. 必要なもの

- Node.js 20以上
- npm
- Supabaseプロジェクト

### 2. インストール

```bash
npm install
```

### 3. 環境変数

プロジェクト直下に `.env.local` を作成します。

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

秘密鍵やService Role KeyはGitへ追加しないでください。

### 4. Supabaseを準備する

新しい環境では `supabase/schema.sql` を適用し、その後 `supabase/migrations/` の未適用ファイルを古い順に適用します。既存環境では、適用済みSQLを繰り返さず、未適用の最新ファイルだけをSupabase SQL Editorで実行してください。

プロフィール保存時に次のエラーが出る場合：

```text
保存に失敗しました: permission denied for table users
```

Supabase SQL Editorで次を一度実行してください。

```text
supabase/migrations/20260826_fix_profile_update_permissions.sql
```

友達DMの公開設定を使う場合は、先に次も一度実行します。

```text
supabase/migrations/20260826_add_feature_flags.sql
```

SQL Editorで `policy already exists` が出た場合は、古いSQLを何度も実行せず、同名ポリシーを安全に処理する最新版のマイグレーションを確認してください。

### 5. 開発サーバー

```bash
npm run dev
```

`http://localhost:3000` を開きます。

## よく使うコマンド

```bash
npm run dev
npm run build
npm run start
npx tsc --noEmit
```

## 保存後の画面遷移

| 操作 | 完了後 |
| --- | --- |
| プロフィール初回設定 | ホーム、またはRA管理画面 |
| プロフィール編集 | 自分のプロフィール |
| イベント作成・編集 | 対象イベントの詳細 |
| お知らせ作成・編集 | 対象お知らせの詳細 |
| アンケート・事前質問保存 | 同じ編集画面で保存結果を表示 |
| ホーム・バッジ・選択肢・公開設定 | 同じ管理画面で即時反映 |
| イベント申込 | 対象イベントのトーク |

複数項目を続けて管理する画面は、その場に残ることを正常な動作としています。

## RA管理画面

RAでログインし、右上のプロフィールメニューから「管理ダッシュボード」を開きます。スマホでは管理メニューが横スクロールのアイコン列になり、パソコンでは一覧表示になります。

友達DMは「機能の公開設定」で次の3段階から選択できます。

- 公開する
- BETAとして公開する
- 公開しない（初期値）

非公開時は画面を隠すだけでなく、Supabase側でもDMとDM画像へのアクセスを停止します。

## 画像アップロード

- 対応形式：PNG / JPEG / WebP（一部トークではGIFも対応）
- プロフィール画像：5MB以下
- トーク画像：送信前にブラウザで圧縮
- イベント画像は表示枠に合わせて統一表示
- LINE QRは非公開Storageに保存

## Gitで共有する

作業前：

```bash
git pull
git status
```

変更後：

```bash
npm run build
git add -A
git commit -m "変更内容を短く説明"
git push
```

`.env.local`、Supabaseの秘密鍵、個人情報を含むCSVやQR画像はコミットしないでください。

## リリース前チェック

- スマホとパソコンで主要画面を確認
- 一般寮生とRAの両方で権限を確認
- イベント作成、申込、トーク、コメントを確認
- Supabaseの未適用マイグレーションを確認
- `npm run build` が成功することを確認
- Vercel Speed Insightsで遅い画面を確認

## トラブルシューティング

### プロフィールを保存できない

`20260826_fix_profile_update_permissions.sql` が適用済みか確認します。RLSポリシーだけでなく、列単位のUPDATE権限も必要です。

### 写真を送信できない

Storageバケット、StorageのRLS、画像形式・容量、友達DMの公開設定を確認します。

### 画面が白く見える・遷移が終わらない

開発者ツールのNetworkとConsole、SupabaseのAPI応答、Vercel Speed Insightsを確認します。アプリには遷移プログレスバーと遷移先型スケルトンが入っているため、これらも表示されない場合はJavaScriptエラーを優先して確認します。

### DB型を更新したい

Supabase CLIを接続後、`package.json` の `gen-types` にあるプロジェクトIDを置き換えて型を再生成します。手書きの補足型を上書きする場合は、差分を必ず確認してください。
