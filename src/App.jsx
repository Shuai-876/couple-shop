import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import LoginPage from './pages/LoginPage'
import CustomerPage from './pages/CustomerPage'
import AdminPage from './pages/AdminPage'

// 依登入狀態與角色決定要看哪一頁
function Router() {
  const { user, profile, loading } = useAuth()

  // 還在確認登入狀態時,先顯示載入中(避免畫面閃動)
  if (loading) {
    return <div className="center-screen">載入中…💕</div>
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : profile?.role === 'admin' ? (
            <AdminPage />
          ) : (
            <CustomerPage />
          )
        }
      />
      {/* 其它網址一律導回首頁 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      {/* GitHub Pages 一定要用 HashRouter,否則重新整理子頁會 404 */}
      <HashRouter>
        <Router />
      </HashRouter>
    </AuthProvider>
  )
}
