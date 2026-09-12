// 10 topics, each mapped to a color palette + mood flags used by the style renderers.
const TOPICS = [
  {
    id: "cosmos",
    label: "Cosmos / Space",
    colors: ["#05010f", "#170a3e", "#3a1c78", "#8b3fd6", "#d98fff"],
    stars: true,
    glow: true,
  },
  {
    id: "ocean",
    label: "Ocean Depths",
    colors: ["#01111c", "#023b52", "#036c7a", "#0aa6a6", "#7fe8d6"],
    stars: false,
    glow: true,
  },
  {
    id: "nature",
    label: "Nature / Meadow",
    colors: ["#0b2210", "#1c4a1f", "#3f7a2e", "#8fbf3f", "#e4f2a3"],
    stars: false,
    glow: false,
  },
  {
    id: "mountains",
    label: "Mountains",
    colors: ["#0d1520", "#233042", "#4a5b73", "#8ea2b8", "#eef3f8"],
    stars: false,
    glow: false,
  },
  {
    id: "cityscape",
    label: "Neon Cityscape",
    colors: ["#08040f", "#1a0b2e", "#5b0e6b", "#ff2e9c", "#26e6ff"],
    stars: false,
    glow: true,
  },
  {
    id: "technology",
    label: "Technology / Digital",
    colors: ["#020a12", "#04202f", "#0a4a5e", "#12b6cc", "#bdf6ff"],
    stars: false,
    glow: true,
  },
  {
    id: "fire",
    label: "Fire & Ember",
    colors: ["#0c0402", "#3a0c02", "#8a1c04", "#f0561a", "#ffcf6b"],
    stars: false,
    glow: true,
  },
  {
    id: "forest",
    label: "Deep Forest",
    colors: ["#080f08", "#122a15", "#204d24", "#3f7a3d", "#a3c98a"],
    stars: false,
    glow: false,
  },
  {
    id: "desert",
    label: "Desert Dunes",
    colors: ["#1a0f08", "#4a2712", "#8a4a1e", "#d68a3c", "#ffd89b"],
    stars: false,
    glow: false,
  },
  {
    id: "aurora",
    label: "Aurora Skies",
    colors: ["#01050c", "#031f2c", "#0a4a3f", "#2ecf8f", "#9c5cff"],
    stars: true,
    glow: true,
  },
];

// 6 aspect ratios, resolved to true 8K-class pixel dimensions (long edge ~7680px,
// short edge scaled to preserve the ratio, capped to stay under canvas limits).
const RATIOS = [
  { id: "16:9", label: "16:9 — Widescreen (7680×4320)", w: 7680, h: 4320 },
  { id: "21:9", label: "21:9 — Ultrawide (7680×3291)", w: 7680, h: 3291 },
  { id: "1:1", label: "1:1 — Square (7680×7680)", w: 7680, h: 7680 },
  { id: "4:3", label: "4:3 — Classic (7680×5760)", w: 7680, h: 5760 },
  { id: "3:2", label: "3:2 — Photo (7680×5120)", w: 7680, h: 5120 },
  { id: "9:16", label: "9:16 — Mobile Portrait (4320×7680)", w: 4320, h: 7680 },
];
