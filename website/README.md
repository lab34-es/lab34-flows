# lab34-flows website

The documentation website for [lab34-flows](https://github.com/lab34-es/lab34-flows),
published at **https://flows.lab34.es/**.

- Built with [Astro](https://astro.build) and Tailwind CSS, styled with the
  [shadcn/ui](https://ui.shadcn.com) design system (its tokens, theme and
  component recipes).
- The **Docs** section is generated at build time from the app's own Help
  section (`frontend/src/components/settings/help/helpContent.js`). Edit the
  in-app help and the website follows — there is no second copy.
- Deployed automatically by `.github/workflows/deploy-website.yml` on every
  push to `master` that touches `website/` or the help content. One-time setup
  in **Settings → Pages**: set **Source** to **GitHub Actions**, set the
  **custom domain** to `flows.lab34.es` and enable **Enforce HTTPS**. In DNS,
  point `flows.lab34.es` with a `CNAME` record to `lab34-es.github.io`.

This folder is completely independent from the CLI package: it is excluded
from the npm publish via the root `.npmignore`, and nothing in `src/` or
`frontend/` depends on it.

## Development

```bash
cd website
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in website/dist
npm run preview
```
