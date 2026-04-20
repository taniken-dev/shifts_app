// 認証ページ共通レイアウト
// 背景・センタリングは各ページ（login/page.tsx）が直接管理する
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
