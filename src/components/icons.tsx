// Ikoner i samma handritade, rundade stil (2px linjer).
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export const IconHome = () => (
  <svg {...base}>
    <path d="M4 11.5 12 5l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-5h-6v5H5.5A1.5 1.5 0 0 1 4 19z" />
  </svg>
);
export const IconDumbbell = () => (
  <svg {...base}>
    <path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11" />
  </svg>
);
export const IconBowl = () => (
  <svg {...base}>
    <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" />
    <path d="M8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5" />
  </svg>
);
export const IconSearch = () => (
  <svg {...base}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);
export const IconTrend = () => (
  <svg {...base}>
    <path d="M3.5 17.5 9 12l3.5 3.5 8-8" />
    <path d="M15 7.5h5.5V13" />
  </svg>
);
export const IconSettings = () => (
  <svg {...base}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);
export const IconUpload = () => (
  <svg {...base}>
    <path d="M12 15V4.5M7.5 9 12 4.5 16.5 9M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" />
  </svg>
);
export const IconPlus = () => (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconTrash = () => (
  <svg {...base} width="16" height="16">
    <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
  </svg>
);
