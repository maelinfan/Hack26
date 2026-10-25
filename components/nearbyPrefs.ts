// Local fake persistence for interests + filters, keyed by user_id. Shapes follow SPEC.md section 6.

export const MAX_TAGS = 8;
export const MIN_AGE = 18;
export const MAX_AGE = 65;

export const SUGGESTED_TAGS = ["bouldering", "coffee", "ramen", "sketching", "hiking", "board games", "film photography", "running"];

export const GENDER_OPTIONS = [
  { value: "woman", label: "Women" },
  { value: "man", label: "Men" },
  { value: "nonbinary", label: "Nonbinary" },
];

export const FOLLOW_OPTIONS = [
  { value: "close_friends", label: "Close friends" },
  { value: "mutual", label: "Mutuals" },
  { value: "following", label: "People I follow" },
  { value: "follows_you", label: "Follow me" },
  { value: "anyone", label: "Anyone" },
];

export type Filters = {
  age_min: number;
  age_max: number;
  genders: string[];
  follow_statuses: string[];
  radius_mi: number | null; // null until the user picks one
};

// Nothing preselected; age spans the full allowed range (no restriction).
export const DEFAULT_FILTERS: Filters = {
  age_min: MIN_AGE,
  age_max: MAX_AGE,
  genders: [],
  follow_statuses: [],
  radius_mi: null,
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: ignore
  }
}

export const loadInterests = (userId: string) => {
  const v = load<unknown>(`interests:${userId}`, []);
  return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string").slice(0, MAX_TAGS) : [];
};
export const saveInterests = (userId: string, tags: string[]) => save(`interests:${userId}`, tags);

export const loadFilters = (userId: string): Filters => {
  const f = { ...DEFAULT_FILTERS, ...load<Partial<Filters>>(`filters:${userId}`, {}) };
  f.age_min = Math.max(MIN_AGE, f.age_min);
  f.age_max = Math.max(f.age_min, f.age_max);
  return f;
};
export const saveFilters = (userId: string, f: Filters) => save(`filters:${userId}`, f);
