# Robiner Dahap — Portfolio

Personal portfolio featuring projects, skills, education, recognition, and a photo gallery.

## Features

- Responsive desktop, tablet, and phone layouts with light and dark themes.
- Interactive portrait, project cards, gallery, and Spotify controls.
- Portfolio assistant for questions about projects and skills.
- Visitor statistics, ratings, and private written feedback.
- Keyboard navigation and reduced-motion support.

## Run locally

Use Node.js 22.9 or newer:

```sh
npm run dev
```

Open the address printed in the terminal. For a phone preview, use the printed LAN address on the same Wi-Fi network.

## Checks

```sh
node --test tests/*.test.mjs
npm run typecheck:supabase
```

## Edit and publish

- Content: `site/assets/data.js`
- Page layouts: `site/assets/portfolio.js`
- Styles: `site/assets/styles.css` and feature stylesheets

The frontend supports GitHub Pages and Vercel without a build step. Supabase database and Edge Function changes are deployed separately.

See [Tech stack and sources](TECH-STACK-AND-SOURCES.md) for implementation details and credits. Keep the included license notices when distributing the code.
