// 圖片壓縮工具
// 把使用者選的照片,在「瀏覽器端」用 canvas 縮小並轉成 base64 data URL,
// 這樣就能直接存進 Firestore 的字串欄位,不需要付費的 Firebase Storage。
//
// 目標:最長邊 600px、JPEG 品質約 0.7,結果盡量 < 200KB(Firestore 單筆上限 1MB)。

const MAX_SIZE = 600        // 最長邊像素
const TARGET_BYTES = 200 * 1024 // 目標 200KB

export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('讀取圖片失敗'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('圖片格式無法解析'))
      img.onload = () => {
        // 依最長邊等比例縮放
        let { width, height } = img
        if (width > height && width > MAX_SIZE) {
          height = Math.round((height * MAX_SIZE) / width)
          width = MAX_SIZE
        } else if (height >= width && height > MAX_SIZE) {
          width = Math.round((width * MAX_SIZE) / height)
          height = MAX_SIZE
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // 從品質 0.7 開始,如果還是太大就逐步降品質,直到 < 200KB(或品質太低就放棄硬壓)
        let quality = 0.7
        let dataUrl = canvas.toDataURL('image/jpeg', quality)
        while (estimateBytes(dataUrl) > TARGET_BYTES && quality > 0.3) {
          quality -= 0.1
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }
        resolve(dataUrl)
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// 估算 base64 data URL 的實際位元組大小
function estimateBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] || ''
  return Math.ceil((base64.length * 3) / 4)
}
