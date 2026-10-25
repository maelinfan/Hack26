type P = { className?: string; filled?: boolean };
const base = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const HomeIcon = ({ className, filled }: P) => (
  <svg {...base} className={className} fill={filled ? "currentColor" : "none"}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
);

export const ShieldCheckIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const CheckBadgeIcon = ({ className }: P) => (
  <svg {...base} width={16} height={16} className={className} fill="currentColor" stroke="none">
    <path d="M12 2l2.4 1.8 3-.1.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3-.1L12 22l-2.4-1.8-3 .1-.9-2.9-2.4-1.8.9-2.9-.9-2.9 2.4-1.8.9-2.9 3 .1z" />
    <path d="m8.5 12 2.5 2.5 4.5-4.5" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronLeftIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);

export const ChevronRightIcon = ({ className }: P) => (
  <svg {...base} width={20} height={20} className={className}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const CheckIcon = ({ className }: P) => (
  <svg {...base} width={14} height={14} strokeWidth={2.5} className={className}>
    <path d="m5 12 5 5 9-10" />
  </svg>
);

export const XIcon = ({ className }: P) => (
  <svg {...base} width={14} height={14} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const TagIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
    <circle cx="8" cy="8" r="1.5" />
  </svg>
);

export const SlidersIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </svg>
);

export const NearbyIcon =({ className, filled }: P) => (
  <svg {...base} className={className}>
    <path
      d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"
      fill={filled ? "currentColor" : "none"}
    />
    <circle cx="12" cy="9.5" r="2.5" fill={filled ? "#fff" : "none"} />
  </svg>
);
