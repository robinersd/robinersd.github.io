# Portfolio

Responsive personal portfolio showcasing software projects, skills, education, recognition, and a photo gallery.

## Features

- Profile name displayed as **Dahap, Robiner B.**
- Spotify instruction with a typing animation, underscore cursor, and message bubble.
- Contrasting message bubble: light in dark mode and dark in light mode.
- Responsive profile artwork, interactive project cards, skill previews, and certificate viewer.
- Right-side page menu with clean text links and the current section highlighted while scrolling. It starts open on desktop and closed on phones.
- Total visits, current viewers, and a public average star rating powered by Supabase. Written feedback stays private.
- Work-inquiry email link with an envelope icon below the feedback button.
- Floating portfolio assistant with a dedicated sidebar dock to keep contact details clear.
- Remembered theme preference, keyboard navigation, and reduced-motion support.

## Technology

HTML, CSS, plain JavaScript, Node.js, and Supabase. The frontend requires no build step and has no runtime npm dependencies.

## Run locally

Use Node.js 22.9 or newer. From the project folder, run:

```powershell
npm run dev
```

Open the address printed in the terminal. To preview on a phone, connect it to the same Wi-Fi and use the printed **Phone / LAN** address. Keep the local server running.

## Tests

```powershell
node --test tests/*.test.mjs
```

## Publishing

The portfolio frontend supports GitHub Pages and Vercel. Vercel uses `site/` as the project root. Supabase provides the visitor and feedback backend independently of frontend hosting.

Retain the included license and asset attribution notices when sharing the code.
