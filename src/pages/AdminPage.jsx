import { useEffect, useRef, useState } from 'react'
import { signOut } from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../auth'
import { compressImage } from '../utils/image'

export default function AdminPage() {
  const { profile } = useAuth()

  // 顧客清單(發代幣的對象)
  const [customers, setCustomers] = useState([])
  const [targetUid, setTargetUid] = useState('')

  // 發代幣表單
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  // 上架商品表單
  const [pName, setPName] = useState('')
  const [pPrice, setPPrice] = useState('')
  const [imageData, setImageData] = useState('') // 壓縮後的 base64
  const [imgBusy, setImgBusy] = useState(false)
  const fileRef = useRef(null)

  // 列表 / 統計資料
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [logs, setLogs] = useState([])

  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // 載入顧客清單(role == customer)
  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'customer'))).then((snap) => {
      const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
      setCustomers(list)
      if (list.length > 0) setTargetUid(list[0].uid)
    })
  }, [])

  // 即時監聽商品(供「商品管理」與「商品總數」用)
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

  // 即時監聽所有訂單(統計購買次數用)
  useEffect(() => {
    return onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

  // 即時監聽發代幣紀錄(統計總發出代幣 + 顯示紀錄)
  useEffect(() => {
    const q = query(collection(db, 'tokenLogs'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

  // ── 發代幣:transaction 累加餘額(沒有文件就建立)+ 記一筆 tokenLog ──
  async function giveTokens(e) {
    e.preventDefault()
    const n = parseInt(amount, 10)
    if (!targetUid) return showToast('請先選擇對象')
    if (!Number.isInteger(n) || n <= 0) return showToast('請輸入正整數數量')

    setBusy(true)
    try {
      await runTransaction(db, async (tx) => {
        const tokenRef = doc(db, 'tokens', targetUid)
        const snap = await tx.get(tokenRef)
        const current = snap.exists() ? snap.data().balance : 0
        if (snap.exists()) {
          tx.update(tokenRef, { balance: current + n, updatedAt: serverTimestamp() })
        } else {
          // 第一次發代幣時自動建立 tokens 文件
          tx.set(tokenRef, { balance: current + n, updatedAt: serverTimestamp() })
        }
        // 記一筆發放紀錄(注意:在 transaction 內用 tx.set 寫,不要混用 addDoc)
        const logRef = doc(collection(db, 'tokenLogs'))
        tx.set(logRef, {
          userId: targetUid,
          amount: n,
          reason: reason.trim() || '發代幣',
          createdAt: serverTimestamp(),
        })
      })
      setAmount('')
      setReason('')
      showToast(`已發出 ${n} 代幣 🪙`)
    } catch (err) {
      showToast('發代幣失敗,請再試一次')
    } finally {
      setBusy(false)
    }
  }

  // 選照片 → 壓縮成 base64 存進 state
  async function onPickImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImgBusy(true)
    try {
      const data = await compressImage(file)
      setImageData(data)
    } catch {
      showToast('圖片處理失敗,換一張試試')
    } finally {
      setImgBusy(false)
    }
  }

  // ── 上架商品 ──
  async function addProduct(e) {
    e.preventDefault()
    const price = parseInt(pPrice, 10)
    if (!pName.trim()) return showToast('請輸入商品名稱')
    if (!Number.isInteger(price) || price <= 0) return showToast('價格請輸入正整數')
    if (!imageData) return showToast('請先選一張商品照片')

    setBusy(true)
    try {
      await addDoc(collection(db, 'products'), {
        name: pName.trim(),
        price,
        image: imageData,
        soldCount: 0,
        createdAt: serverTimestamp(),
      })
      // 清空表單
      setPName('')
      setPPrice('')
      setImageData('')
      if (fileRef.current) fileRef.current.value = ''
      showToast('商品已上架 🎉')
    } catch (err) {
      showToast('上架失敗,請再試一次')
    } finally {
      setBusy(false)
    }
  }

  // 刪除商品
  async function removeProduct(id) {
    if (!confirm('確定要刪除這個商品嗎?')) return
    try {
      await deleteDoc(doc(db, 'products', id))
      showToast('已刪除')
    } catch {
      showToast('刪除失敗')
    }
  }

  // 統計數字(代幣是整數,直接加總)
  const totalGiven = logs.reduce((sum, l) => sum + (l.amount || 0), 0)
  const totalOrders = orders.length

  return (
    <div className="page">
      <header className="topbar">
        <div className="hi">管理後台 · {profile?.name || '管理員'} 🛠️</div>
        <button className="btn btn-ghost" onClick={() => signOut(auth)}>
          登出
        </button>
      </header>

      <main className="content">
        {/* 統計 */}
        <div className="stats">
          <div className="stat-box">
            <div className="stat-num">{totalGiven}</div>
            <div className="stat-label">總發出代幣</div>
          </div>
          <div className="stat-box">
            <div className="stat-num">{totalOrders}</div>
            <div className="stat-label">購買次數</div>
          </div>
          <div className="stat-box">
            <div className="stat-num">{products.length}</div>
            <div className="stat-label">商品總數</div>
          </div>
        </div>

        {/* 發代幣 */}
        <section className="card form-card">
          <h2 className="section-title">發代幣</h2>
          <form onSubmit={giveTokens}>
            <label className="field-label">對象</label>
            <select
              className="input"
              value={targetUid}
              onChange={(e) => setTargetUid(e.target.value)}
            >
              {customers.length === 0 && <option value="">(尚無顧客帳號)</option>}
              {customers.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.name || c.email}
                </option>
              ))}
            </select>

            <label className="field-label">數量(正整數)</label>
            <input
              className="input"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例如 100"
            />

            <label className="field-label">理由(可留空)</label>
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例如:這週很乖 💕"
            />

            <button className="btn btn-primary" disabled={busy}>
              {busy ? '處理中…' : '發出代幣'}
            </button>
          </form>
        </section>

        {/* 上架商品 */}
        <section className="card form-card">
          <h2 className="section-title">上架商品</h2>
          <form onSubmit={addProduct}>
            <label className="field-label">商品名稱</label>
            <input
              className="input"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              placeholder="例如:一次擁抱券"
            />

            <label className="field-label">代幣價格(正整數)</label>
            <input
              className="input"
              type="number"
              min="1"
              value={pPrice}
              onChange={(e) => setPPrice(e.target.value)}
              placeholder="例如 50"
            />

            <label className="field-label">商品照片</label>
            <input
              className="input"
              type="file"
              accept="image/*"
              ref={fileRef}
              onChange={onPickImage}
            />
            {imgBusy && <div className="hint">壓縮圖片中…</div>}
            {imageData && <img className="preview-img" src={imageData} alt="預覽" />}

            <button className="btn btn-primary" disabled={busy || imgBusy}>
              {busy ? '上架中…' : '上架商品'}
            </button>
          </form>
        </section>

        {/* 商品管理 */}
        <section className="card form-card">
          <h2 className="section-title">商品管理</h2>
          {products.length === 0 && <p className="empty">還沒有商品</p>}
          <ul className="manage-list">
            {products.map((p) => (
              <li className="manage-item" key={p.id}>
                {p.image && <img className="manage-thumb" src={p.image} alt={p.name} />}
                <span className="manage-name">{p.name}</span>
                <span className="manage-price">🪙 {p.price}</span>
                <button className="btn btn-danger btn-sm" onClick={() => removeProduct(p.id)}>
                  刪除
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* 發代幣紀錄 */}
        <section className="card form-card">
          <h2 className="section-title">發代幣紀錄</h2>
          {logs.length === 0 && <p className="empty">還沒有發過代幣</p>}
          <ul className="history-list">
            {logs.map((l) => (
              <li className="history-item" key={l.id}>
                <span>+{l.amount} 🪙</span>
                <span className="history-reason">{l.reason}</span>
                <span className="history-date">{fmtDate(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function fmtDate(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}
