import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ⚠️ 重要:base 必須是「/你的GitHub-repo名/」,前後都要有斜線。
// 預設用 couple-shop,部署前請改成你自己的 repo 名稱,
// 否則 GitHub Pages 上線後會找不到 JS/CSS,變成白畫面。
export default defineConfig({
  plugins: [react()],
  base: '/couple-shop/',
})
