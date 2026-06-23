import { useEffect, useRef, useState } from 'react'
import { signOut } from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../auth'
import { compressImage } from '../utils/image'
import { sendNotify } from '../email'

export default function CustomerPage() {
  const { user, profile } = useAuth()
  const [balance, setBalance] = useState(null) // null = 還沒載入
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [tasks, setTasks] = useState([])
  const [claims, setClaims] = useState([]) // 自己的完成申請
  const [confirming, setConfirming] = useState(null) // 正在確認購買的商品
  const [claimingTask, setClaimingTask] = useState(null) // 正在申請完成的任務
  const [claimPhoto, setClaimPhoto] = useState('') // 申請要附的照片(壓縮後 base64)
  const [claimNote, setClaimNote] = useState('') // 申請留言
  const [imgBusy, setImgBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [admin, setAdmin] = useState(null) // 管理員資料(寄信通知用)
  const photoRef = useRef(null)

  // 載入管理員資料(role == admin),送出申請時用來寄信通知他
  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'admin'))).then((snap) => {
      if (!snap.empty) setAdmin(snap.docs[0].data())
    })
  }, [])

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

  // 即時監聽任務列表(只取上架中的;在前端依建立時間排序,避免要建複合索引)
  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => t.active !== false)
      setTasks(list)
    })
  }, [])

  // 即時監聽自己的完成申請(只用 userId 過濾,排序在前端做,免複合索引)
  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'taskClaims'), where('userId', '==', user.uid))
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setClaims(list)
    })
  }, [user])

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

  // 打開「申請完成任務」視窗,清空上次的照片/留言
  function openClaim(task) {
    setClaimingTask(task)
    setClaimPhoto('')
    setClaimNote('')
    if (photoRef.current) photoRef.current.value = ''
  }

  // 選照片 → 壓縮成 base64
  async function onPickPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImgBusy(true)
    try {
      setClaimPhoto(await compressImage(file))
    } catch {
      showToast('照片處理失敗,換一張試試')
    } finally {
      setImgBusy(false)
    }
  }

  // 送出完成申請(狀態 pending;獎勵金額照任務設定,等他核准才入帳)
  async function submitClaim() {
    // 是否需要附照片,依任務設定(沒設定預設要附)
    const needPhoto = claimingTask.requirePhoto !== false
    if (needPhoto && !claimPhoto) return showToast('這個任務要附完成照片喔')
    // 每日刷新任務:今天已領過就擋下
    if (claimingTask.daily && todayClaim(claimingTask.id)) {
      setClaimingTask(null)
      return showToast('這個任務今天領過囉,明天再來 💕')
    }
    setBusy(true)
    try {
      await addDoc(collection(db, 'taskClaims'), {
        taskId: claimingTask.id,
        taskTitle: claimingTask.title,
        reward: claimingTask.reward,
        userId: user.uid,
        status: 'pending',
        photo: claimPhoto,
        note: claimNote.trim(),
        dayKey: todayKey, // 記下是紐約時間哪一天送的
        createdAt: serverTimestamp(),
      })
      // 寄信通知管理員(best-effort,失敗不影響送出)
      sendNotify({
        toEmail: admin?.email,
        toName: admin?.name,
        title: `💕 ${profile?.name || '她'}申請完成任務`,
        message: `${profile?.name || '她'} 申請完成任務「${claimingTask.title}」(獎勵 ${claimingTask.reward} 代幣)。${
          claimNote.trim() ? `留言:${claimNote.trim()}。` : ''
        }快到管理頁審核吧!`,
      })
      showToast('已送出,等他確認囉 💌')
    } catch (err) {
      showToast('送出失敗,請再試一次')
    } finally {
      setBusy(false)
      setClaimingTask(null)
    }
  }

  // 把申請狀態翻成中文標籤
  const statusText = { pending: '待確認', approved: '已核准 ✅', rejected: '已退回' }

  // 今天(紐約時間)的日期 key
  const todayKey = nyDayKey()
  // 找出某任務「今天」已送出或已核准的申請(每日任務用來判斷今天是否已領過)
  function todayClaim(taskId) {
    return claims.find(
      (c) =>
        c.taskId === taskId &&
        c.dayKey === todayKey &&
        (c.status === 'pending' || c.status === 'approved'),
    )
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
        {/* 任務 */}
        <h2 className="section-title">任務 🎯</h2>
        {tasks.length === 0 && <p className="empty">目前沒有任務,等他出題～</p>}
        <div className="task-list">
          {tasks.map((t) => {
            // 每日任務才需要判斷今天是否領過
            const doneToday = t.daily ? todayClaim(t.id) : null
            return (
              <div className="card task-card" key={t.id}>
                <div className="task-top">
                  <span className="task-title">{t.title}</span>
                  <span className="task-reward">+{t.reward} 🪙</span>
                </div>
                {t.description && <p className="task-desc">{t.description}</p>}
                <div className="task-tags">
                  {t.daily && <span className="tag">每日刷新</span>}
                  {t.requirePhoto !== false && <span className="tag">需附照片</span>}
                </div>
                {doneToday ? (
                  <button className="btn btn-ghost btn-sm" disabled>
                    {doneToday.status === 'approved' ? '今天已完成 ✅' : '今天已送出,待確認'}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => openClaim(t)}
                  >
                    我完成了,領獎勵
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* 我的任務申請狀態 */}
        {claims.length > 0 && (
          <>
            <h2 className="section-title">我的任務申請</h2>
            <ul className="history-list">
              {claims.map((c) => (
                <li className="history-item" key={c.id}>
                  <span>{c.taskTitle}</span>
                  <span className={`status-badge status-${c.status}`}>{statusText[c.status] || c.status}</span>
                  <span className="history-date">{fmtDate(c.createdAt)}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* 商品 */}
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

        <h2 className="section-title">待兌換清單</h2>
        <p className="hint">買到的東西會在這裡等他幫你兌換,兌換完成後就會消失 💕</p>
        {orders.length === 0 && <p className="empty">目前沒有待兌換的東西</p>}
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

      {/* 申請完成任務彈窗(要附照片) */}
      {claimingTask && (
        <div className="modal-mask" onClick={() => !busy && !imgBusy && setClaimingTask(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-text">
              完成任務:<b>{claimingTask.title}</b><br />
              獎勵 <b>+{claimingTask.reward} 🪙</b>(他確認後入帳)
            </p>

            <label className="field-label">
              附上完成照片{claimingTask.requirePhoto !== false ? '(必填)' : '(可選)'}
            </label>
            <input
              className="input"
              type="file"
              accept="image/*"
              ref={photoRef}
              onChange={onPickPhoto}
            />
            {imgBusy && <div className="hint">壓縮照片中…</div>}
            {claimPhoto && <img className="preview-img" src={claimPhoto} alt="預覽" />}

            <label className="field-label">想說的話(可留空)</label>
            <input
              className="input"
              value={claimNote}
              onChange={(e) => setClaimNote(e.target.value)}
              placeholder="例如:我做到了!💪"
            />

            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                disabled={busy || imgBusy}
                onClick={() => setClaimingTask(null)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                disabled={busy || imgBusy}
                onClick={submitClaim}
              >
                {busy ? '送出中…' : '送出申請'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// 取得「紐約時間」的今天日期字串(例如 2026-06-22),夏令時間會自動處理。
// 每日刷新任務就是用這個 key 判斷是否同一天。
function nyDayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

// 把 Firestore timestamp 轉成好讀的日期字串
function fmtDate(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}
