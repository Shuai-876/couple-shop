import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

// 用 React Context 把「登入狀態」分享給整個 app,任何頁面都能取用
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)     // Firebase 的登入帳號(含 uid、email)
  const [profile, setProfile] = useState(null) // users/{uid} 文件(含 name、role)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 監聽登入狀態變化:登入、登出、重新整理都會觸發
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        // 登入後去資料庫讀這個人的資料(name / role)
        const snap = await getDoc(doc(db, 'users', u.uid))
        setProfile(snap.exists() ? snap.data() : null)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// 方便各頁面取用登入資訊的小工具
export function useAuth() {
  return useContext(AuthContext)
}
