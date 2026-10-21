# Tech stack and sources

## Portfolio implementation

- **Frontend:** HTML, custom CSS, and plain JavaScript ES modules. No frontend build step or runtime npm packages.
- **Local server:** Node.js built-in HTTP and filesystem APIs.
- **Hosting:** GitHub Pages for the static frontend; Vercel for the frontend and server-side chat endpoint.
- **Database:** Supabase PostgreSQL for visitor totals, active sessions, ratings, and feedback. An Edge Function validates requests and returns aggregate statistics; written feedback stays private.
- **Assistant:** Shared public portfolio facts for skills and project questions, with a server-side AI integration for other supported requests.
- **Media:** Browser Canvas, Web Audio, MediaRecorder, and native dialogs for attachments, previews, and viewers. Spotify uses its official iframe API.
- **Development:** Node's test runner, TypeScript checks for the Edge Function, and repository formatting settings.

## Current interface

- Desktop and tablet navigation uses a fixed sidebar. Phones use a three-line menu with the sidebar initially closed. Its scrollbar is hidden while scrolling remains available.
- The transparent portrait has a color-preserving halftone texture. Its wind dissolve lasts **13 seconds**, advancing upward from the body to the face. The real portrait is revealed behind the cleared area to avoid overlap.
- Project links open with one desktop/tablet click or two phone taps. Phone cards also support swiping.
- The gallery uses a bounded image trail and compact image viewer. Its decorative bubble no longer includes the large quotation marks.
- Themes, keyboard controls, visibility handling, and reduced-motion preferences are implemented locally.

## Design references and attribution

- Profile interaction: [Bryll Lim](https://bryllim.com/). The initial reveal implementation was adapted from the supplied [React Bits PixelTransition](https://reactbits.dev/animations/pixel-transition) reference; the current wind dissolve uses native Canvas.
- Star background: [Aceternity UI Shooting Stars](https://ui.aceternity.com/components/shooting-stars-and-stars-background), adapted to bounded native Canvas rendering.
- Gallery trail: user-supplied PixelatedImageTrail reference, adapted to JavaScript and CSS.
- Skills entrance: supplied StaggeredGrid reference credited to [Codrops demos](https://tympanus.net/codrops/demos/), implemented with native scroll progress and CSS.
- Project expansion: supplied TeamRevealGrid reference, adapted to the current desktop project cards. Touch tablets display details without requiring hover.
- Circular theme transition: inspired by [KB Jacalan](https://kbjacalan.vercel.app/), implemented with native View Transitions and a CSS fallback.
- Spotify chooser: adapted from the supplied MusicPlayer reference. Playback uses the official Spotify API and remains subject to browser playback restrictions.

These references are design sources; they do not add React or GSAP dependencies to the portfolio.

## Images, icons, and licenses

Portraits, project photos, gallery photos, and certificate artwork were supplied for this portfolio. Some illustration, restoration, and decorative-image edits used the built-in image tool. The active media is stored under `site/assets/images/`.

Brand icon sources and notices are recorded in [Icon sources](site/assets/icons/SOURCES.md) and the included Devicon license. Keep [React Bits notices](site/assets/REACT-BITS-LICENSE.md) and other source notices with the distributed code. Third-party marks belong to their respective owners. The name badge is decorative.

Fonts use the system stack, with Inter when available locally.

## Project stacks shown in the portfolio

AlagaTrack and StreetWear list TypeScript, React, Tailwind CSS, Vite, PostgreSQL, and Supabase. Medicare lists embedded systems and technical/system documentation. These describe the showcased projects rather than the portfolio's own runtime dependencies.
