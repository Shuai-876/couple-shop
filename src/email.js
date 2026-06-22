// EmailJS 寄信設定
// ─────────────────────────────────────────────
// 這是用來「從前端網頁直接寄 Email」的服務,免費、不需要後端。
//
// ⚠️ 請到 https://www.emailjs.com/ 註冊免費帳號後,把下面三個值換成你自己的:
//    1) Public Key:Account → General → Public Key
//    2) Service ID :Email Services → 你建立的服務(連你的 Gmail)
//    3) Template ID:Email Templates → 你建立的範本
//
//    範本(Template)裡請使用這幾個變數(大小寫要一致):
//       收件人 To Email 欄位填:{{to_email}}
//       主旨 Subject 填:        {{title}}
//       內文 Content 填:        {{message}}(可再加 {{to_name}})
//
// 備註:Public Key 出現在前端是正常的(EmailJS 設計上就是這樣用),跟 Firebase 的 apiKey 一樣。

import emailjs from '@emailjs/browser'

const EMAILJS_PUBLIC_KEY = '請填入你的_PUBLIC_KEY'
const EMAILJS_SERVICE_ID = '請填入你的_SERVICE_ID'
const EMAILJS_TEMPLATE_ID = '請填入你的_TEMPLATE_ID'

// 還沒填金鑰時回傳 false,避免亂報錯
function isConfigured() {
  return ![EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID].some((v) =>
    v.startsWith('請填入'),
  )
}

// 寄一封通知信。寄信失敗不會影響主流程(只在 console 留個警告)。
export async function sendNotify({ toEmail, toName, title, message }) {
  if (!isConfigured()) {
    console.warn('EmailJS 尚未設定金鑰,略過寄信。')
    return
  }
  if (!toEmail) return
  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      { to_email: toEmail, to_name: toName || '', title, message },
      { publicKey: EMAILJS_PUBLIC_KEY },
    )
  } catch (e) {
    console.warn('寄信失敗(不影響主流程):', e)
  }
}
