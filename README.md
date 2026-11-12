# RiseGenie website

Neo-brutalist rebuild of risegenie.com — Next.js (App Router), Tailwind v4, `motion` for animation and
`@react-three/fiber` for the 3D hero.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build && npm run start
```

- Content lives in `src/lib/data.ts` (services, team, testimonials, contact details).
- Sections are in `src/components/site/`; the 3D scene is `HeroScene.tsx` (lazy-loaded, client-only).
- Forms open a pre-filled `mailto:` — wire them to your CRM/GoHighLevel webhook for production.
