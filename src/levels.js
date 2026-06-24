// 升級制度設定
// 每「累積獲得」這麼多代幣就升一級;每升「1 級」可兌換一個神祕獎品。
export const LEVEL_STEP = 1500
export const LEVELS_PER_MYSTERY = 1

// 由「累積總共獲得的代幣」算出等級(整數,只升不降)
export function computeLevel(totalEarned) {
  return Math.floor((totalEarned || 0) / LEVEL_STEP)
}

// 到目前等級「總共應得」幾個神祕獎品(每 5 級 1 個)
export function mysteryEntitled(level) {
  return Math.floor((level || 0) / LEVELS_PER_MYSTERY)
}

// 距離下一級還差多少、目前這級進度(0~LEVEL_STEP)
export function levelProgress(totalEarned) {
  const into = (totalEarned || 0) % LEVEL_STEP
  return { into, remain: LEVEL_STEP - into }
}

// 距離 9/19(當年,已過則算下一年)還有幾週幾天
// 用「日期」算(不受當下幾點影響),且含 9/19 當天,所以 +1
export function countdownToSep19() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let target = new Date(today.getFullYear(), 8, 19) // 8 = September
  if (target < today) target = new Date(today.getFullYear() + 1, 8, 19)
  const diffDays = Math.round((target - today) / 86400000) + 1
  return { weeks: Math.floor(diffDays / 7), days: diffDays % 7 }
}
