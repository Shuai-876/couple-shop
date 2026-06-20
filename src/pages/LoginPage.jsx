import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      // 用 Email/密碼登入;成功後 App.jsx 會依角色自動導頁
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      // 把 Firebase 的錯誤碼翻成看得懂的中文
      const map = {
        'auth/invalid-email': 'Email 格式不對',
        'auth/user-not-found': '找不到這個帳號',
        'auth/wrong-password': '密碼錯誤',
        'auth/invalid-credential': '帳號或密碼錯誤',
        'auth/too-many-requests': '嘗試太多次,請稍後再試',
      }
      setError(map[err.code] || '登入失敗,請再試一次')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">我們的代幣商城 💕</h1>
        <p className="login-sub">登入後開始逛逛吧～</p>

        <label className="field-label">Email</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="username"
          required
        />

        <label className="field-label">密碼</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />

        {error && <div className="error-box">{error}</div>}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? '登入中…' : '登入'}
        </button>
      </form>
    </div>
  )
}
