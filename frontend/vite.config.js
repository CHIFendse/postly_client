import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Это связывает алиас @bindings с реальной папкой биндингов
      '@bindings': path.resolve(__dirname, './bindings'),
      // На всякий случай добавим стандартный алиас для src
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    // Чтобы в dev-режиме было проще дебажить
    minify: false,
  },
  server: {
    port: 5173, // Укажи здесь тот же порт, что в wails.json
    strictPort: true,
    host: '127.0.0.1',
  }
})