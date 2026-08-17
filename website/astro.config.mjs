// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Deployed to GitHub Pages at https://lab34-es.github.io/lab34-flows/
export default defineConfig({
  site: 'https://lab34-es.github.io',
  base: '/lab34-flows',
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
