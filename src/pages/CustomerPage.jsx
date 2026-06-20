import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../auth'

export default function CustomerPage() {
  const { user, profile } = useAuth()
  const [balance, setBalance] = useState(null) // null = 還沒載入
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [confirming, setConfirming] = useState(null) // 正在確認購買的商品
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  // 即時監聽自己的代幣餘額(tokens/{uid}),餘額一變畫面就更新
  useEffect(() => {
    if (!user) return
    return onSnapshot(doc(db, 'tokens', user.uid), (snap) => {
      setBalance(snap.exists() ? snap.data().balance : 0)
    })
  }, [user])

  // 即時監聽商品列表(新上架的會自動出現),依建立時間倒序
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

  // 即時監聽自己的購買歷史(orders 裡 userId 是自己的),時間倒序
  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [user])

  // 顯示短暫提示訊息
  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // 真正執行購買:用 transaction 一次做完讀餘額、檢查、扣款、建訂單
  async function buy(product) {
    setBusy(true)
    try {
      await runTransaction(db, async (tx) => {
        const tokenRef = doc(db, 'tokens', user.uid)
        const tokenSnap = await tx.get(tokenRef)
        const current = tokenSnap.exists() ? tokenSnap.data().balance : 0

        // 代幣是整數,直接整數比較,沒有浮點誤差問題
        if (current < product.price) {
          throw new Error('餘額不足')
        }

        // 1) 扣代幣
        tx.update(tokenRef, {
          balance: current - product.price,
          updatedAt: serverTimestamp(),
        })

        // 2) 建立訂單(productName 冗餘存一份,日後好顯示)
        const orderRef = doc(collection(db, 'orders'))
        tx.set(orderRef, {
          userId: user.uid,
          productId: product.id,
          productName: product.name,
          price: product.price,
          createdAt: serverTimestamp(),
        })
      })
      showToast(`購買成功:${product.name} 🎉`)
    } catch (err) {
      showToast(err.message === '餘額不足' ? '代幣不足,買不起這個喔 🥺' : '購買失敗,請再試一次')
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  return (
    <div className="page">
      {/* 頂部:餘額 + 登出 */}
      <header className="topbar">
        <div>
          <div className="hi">嗨,{profile?.name || '寶貝'} 💗</div>
          <div className="balance">
            <span className="coin">🪙</span>
            {balance === null ? '…' : balance} 代幣
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => signOut(auth)}>
          登出
        </button>
      </header>

      <main className="content">
        <h2 className="section-title">商品列表</h2>
        {products.length === 0 && <p className="empty">還沒有任何商品,等他上架吧～</p>}

        <div className="product-grid">
          {products.map((p) => (
            <div className="card product-card" key={p.id}>
              {p.image ? (
                <img className="product-img" src={p.image} alt={p.name} />
              ) : (
                <div className="product-img placeholder">無圖</div>
              )}
              <div className="product-name">{p.name}</div>
              <div className="product-price">🪙 {p.price}</div>
              <button
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() => setConfirming(p)}
              >
                購買
              </button>
            </div>
          ))}
        </div>

        <h2 className="section-title">購買歷史</h2>
        {orders.length === 0 && <p className="empty">還沒有購買紀錄</p>}
        <ul className="history-list">
          {orders.map((o) => (
            <li className="history-item" key={o.id}>
              <span>{o.productName}</span>
              <span className="history-price">-{o.price} 🪙</span>
              <span className="history-date">{fmtDate(o.createdAt)}</span>
            </li>
          ))}
        </ul>
      </main>

      {/* 購買確認彈窗 */}
      {confirming && (
        <div className="modal-mask" onClick={() => !busy && setConfirming(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-text">
              要用 <b>🪙 {confirming.price}</b> 代幣購買<br />
              <b>{confirming.name}</b> 嗎?
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(null)}>
                取消
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => buy(confirming)}>
                {busy ? '處理中…' : '確定購買'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// 把 Firestore timestamp 轉成好讀的日期字串
function fmtDate(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}
