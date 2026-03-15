import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

export default defineConfig({
  output: "static",

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          assetFileNames: (info) => {
            if (info.name?.endsWith(".css")) return "etc/[hash].css"
            return "usr/lib/[hash][extname]"
          },
          chunkFileNames: "lib/[hash].js",
          entryFileNames: "lib/[hash].js",
        },
      },
    },
  },
})
