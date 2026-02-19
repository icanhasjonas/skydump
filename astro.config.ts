import { defineConfig } from "astro/config"
import tailwindcss from "@tailwindcss/vite"
import react from "@astrojs/react"
import cloudflare from "@astrojs/cloudflare"

export default defineConfig({
  output: "server",
  adapter: cloudflare(),

  security: {
    checkOrigin: false,
  },

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          hashCharacters: "base36",
          chunkFileNames: "lib/[hash].js",
          entryFileNames: "lib/[hash].js",
          assetFileNames(chunkInfo) {
            if (chunkInfo.names?.some((x) => x.endsWith(".css"))) {
              return "etc/[hash].[ext]"
            }
            return "usr/lib/[hash].[ext]"
          },
        },
      },
    },
  },
})
