// 升級制度設定
// 每「累積獲得」這麼多代幣就升一級;每升一級可兌換一個神祕獎品。
export const LEVEL_STEP = 750

// 由「累積總共獲得的代幣」算出等級(整數,只升不降)
export function computeLevel(totalEarned) {
  return Math.floor((totalEarned || 0) / LEVEL_STEP)
}

// 距離下一級還差多少、目前這級進度(0~LEVEL_STEP)
export function levelProgress(totalEarned) {
  const into = (totalEarned || 0) % LEVEL_STEP
  return { into, remain: LEVEL_STEP - into }
}
