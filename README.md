# Chandan Mitra — Portfolio & Bio Site

A static, single-page professional portfolio site: hero, about, career
timeline, ventures/portfolio, skills, education, certifications & awards,
and contact — all client-side HTML/CSS/JS, no build step required.

## Usage

Open `index.html` directly in a browser, or serve the folder with any
static file server, e.g.:

```
npx serve .
```

## Project structure

```
index.html        Markup / content (all sections)
css/style.css      Styling — dark editorial theme, responsive, reveal animations
js/main.js          Sticky nav, mobile menu, scroll-reveal, animated stat counters
```

## Sections

1. Hero — headline, positioning, quick stats
2. About — professional summary
3. Experience — full career timeline
4. Ventures & Portfolio — products, agencies, and programs built/led
5. Skills — grouped by category (Product, Marketing OS, Platform, Data/AI, Growth)
6. Education
7. Credentials — certifications & awards
8. Contact — email, phone, LinkedIn, location

## Customizing

All content lives directly in `index.html`; colors and typography are
CSS custom properties at the top of `css/style.css` (`--accent`, `--serif`,
`--sans`, etc.) for easy re-theming.
