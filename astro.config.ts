import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import robotsTxt from 'astro-robots-txt'
import sitemap from '@astrojs/sitemap'
import react from '@astrojs/react'

import compress from 'astro-compress'

export default defineConfig({
	site: 'https://sky-dump.pages.dev',
	output: 'static',
	outDir: 'dist',
	integrations: [
		react(),
		sitemap(),
		robotsTxt({
			sitemap: true,
			host: true
		}),
		compress()
	],

	prefetch: {
		defaultStrategy: 'tap',
		prefetchAll: true
	},

	vite: {
		plugins: [tailwindcss()],
		build: {
			rollupOptions: {
				output: {
					hashCharacters: 'base36',
					chunkFileNames: 'lib/[hash].js',
					entryFileNames: 'lib/[hash].js',
					assetFileNames(chunkInfo) {
						if (chunkInfo.names.some((x) => x.endsWith('.css'))) {
							return 'etc/[hash].[ext]'
						}
						if (chunkInfo.names.some((x) => x.endsWith('.jpg') || x.endsWith('.jpeg'))) {
							// rename jpeg files
							return 'usr/lib/[hash].jpeg'
						}
						return 'usr/lib/[hash].[ext]'
					},
					banner(chunk) {
						if (chunk.fileName.endsWith('.css') || chunk.fileName.endsWith('.js')) {
							return `/* generated for SKY DUMP ©️ ${new Date().getFullYear()} */\n`
						}
						return ''
					}
				}
			}
		}
	}
})
