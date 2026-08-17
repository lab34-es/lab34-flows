// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Deployed to GitHub Pages at the custom domain https://flows.lab34.es/
// (public/CNAME + the Pages custom-domain setting in the repository).
export default defineConfig({
  site: 'https://flows.lab34.es',
  trailingSlash: 'always',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      fs: {
        // The docs content is imported straight from the app's Help section,
        // which lives outside this Vite root (../frontend).
        allow: ['..'],
      },
    },
  },
});
