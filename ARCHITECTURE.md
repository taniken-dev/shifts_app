# MOS Shift App — アーキテクチャ設計

## システム構成

```
[スタッフ/管理者のスマホ・PC]
        │ HTTPS
        ▼
[Vercel Edge Network]
  ├── Next.js App Router (SSR/RSC)
  │     ├── Server Components (データ取得)
  │     ├── Server Actions  (ミューテーション)
  │     └── Route Handlers  (CSVエクスポート)
  │
  └── Supabase (BaaS)
        ├── Auth       (JWT + セッション管理)
        ├── PostgreSQL (RLS付きDB)
        └── Storage    (将来: シフト表PDF保存用)
```

## フォルダ構造

```
mos-shift-app/
├── src/
│   ├── app/
│   │   ├── (auth)/                    # 認証不要のページグループ
│   │   │   ├── login/
│   │   │   │   └── page.tsx           # ログインページ
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (dashboard)/               # 認証必須のページグループ
│   │   │   ├── staff/
│   │   │   │   ├── shifts/
│   │   │   │   │   ├── page.tsx       # シフト一覧・提出フォーム
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx   # シフト編集
│   │   │   │   └── layout.tsx
│   │   │   │
│   │   │   ├── admin/
│   │   │   │   ├── shifts/
│   │   │   │   │   └── page.tsx       # 全スタッフシフト一覧
│   │   │   │   ├── staff/
│   │   │   │   │   └── page.tsx       # スタッフ管理
│   │   │   │   └── layout.tsx
│   │   │   │
│   │   │   └── layout.tsx             # 認証チェック共通レイアウト
│   │   │
│   │   ├── api/
│   │   │   ├── shifts/
│   │   │   │   └── route.ts           # GET/POST/PATCH/DELETE
│   │   │   └── export/
│   │   │       └── route.ts           # CSVエクスポート
│   │   │
│   │   ├── globals.css
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── ui/                        # 再利用可能な基本UIパーツ
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Badge.tsx
│   │   │
│   │   ├── auth/
│   │   │   └── LoginForm.tsx
│   │   │
│   │   ├── shifts/
│   │   │   ├── ShiftForm.tsx          # シフト入力フォーム
│   │   │   ├── ShiftCard.tsx          # シフトカード（スタッフ用）
│   │   │   └── ShiftCalendar.tsx      # カレンダービュー
│   │   │
│   │   └── admin/
│   │       ├── ShiftTable.tsx         # 全スタッフシフト一覧テーブル
│   │       ├── ExportButton.tsx       # CSVエクスポートボタン
│   │       └── StaffManager.tsx       # スタッフ追加・削除
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # ブラウザ用クライアント
│   │   │   ├── server.ts              # サーバー用クライアント (cookie)
│   │   │   └── middleware.ts          # セッションリフレッシュ
│   │   │
│   │   ├── validations/
│   │   │   └── shift.ts               # Zod スキーマ (共通バリデーション)
│   │   │
│   │   └── utils/
│   │       └── csv.ts                 # CSVシリアライザ
│   │
│   ├── types/
│   │   └── database.ts                # DB型定義
│   │
│   └── middleware.ts                  # Edge Middleware (認証ガード)
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql     # テーブル・RLS・トリガー
│   └── seed.sql                       # 開発用シードデータ
│
├── public/
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

## DBスキーマ関係図

```
auth.users (Supabase管理)
    │ 1:1 (トリガーで自動作成)
    ▼
profiles
    │ id (PK, FK → auth.users.id)
    │ staff_code  UNIQUE
    │ full_name
    │ role        'staff' | 'admin'
    │ is_active
    │
    │ 1:N
    ▼
shifts
    │ id          UUID PK
    │ profile_id  FK → profiles.id
    │ shift_date  DATE
    │ start_time  TIME
    │ end_time    TIME
    │ note        TEXT (≤500文字)
    └ status      'submitted' | 'approved' | 'rejected'
```

## セキュリティ設計のポイント

| 脅威 | 対策 |
|------|------|
| 他スタッフのシフト閲覧 | RLS: `profile_id = auth.uid()` |
| role の自己昇格 | RLS UPDATE CHECK で role 変更を禁止 |
| 承認済みシフトの改ざん | RLS: `status = 'submitted'` の場合のみ UPDATE 許可 |
| SQLインジェクション | supabase-js のパラメータバインディングを使用 |
| XSS | Next.js のデフォルトエスケープ + CSP ヘッダー |
| CSRF | Server Actions の組み込み CSRF 保護 |
| セッションハイジャック | Supabase JWT (短期) + RefreshToken (HttpOnly Cookie) |
