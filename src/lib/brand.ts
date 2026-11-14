// Brand is configurable via env; nothing else in the app hardcodes the name or colors.
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "RiseGenie Recorder",
  short: process.env.NEXT_PUBLIC_BRAND_SHORT || "Recorder",
  primary: process.env.NEXT_PUBLIC_BRAND_PRIMARY || "#5b3df5",
  accent: process.env.NEXT_PUBLIC_BRAND_ACCENT || "#ff5c39",
  /** Optional absolute URL or /public path to a logo image. Falls back to the built-in mark. */
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL || "",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || "Record it once. Share it, review it, reuse it.",
};

export function brandStyle(): React.CSSProperties {
  return { "--brand": brand.primary, "--brand-accent": brand.accent } as React.CSSProperties;
}
