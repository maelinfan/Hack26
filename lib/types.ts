// Shared backend types. Shapes follow SPEC.md sections 3 and 6.

export type Gender = "woman" | "man" | "nonbinary";

export type FollowStatus =
  | "close_friends"
  | "mutual"
  | "following"
  | "follows_you"
  | "anyone";

export type Tag = { tag: string; category: string; weight: number };

export type User = {
  id: string;
  name: string;
  handle: string;
  age: number;
  gender: Gender;
  bio: string;
  interests_raw: string;
  tags: Tag[];
  adjacent_tags: string[];
  verified: boolean;
  avatar_url: string;
};

export type Follow = {
  follower_id: string;
  followee_id: string;
  close_friend: boolean;
};

export type Filters = {
  user_id: string;
  age_min: number;
  age_max: number;
  genders: Gender[];
  follow_statuses: FollowStatus[];
  radius_mi: number;
};

export type Presence = {
  user_id: string;
  lat: number;
  lng: number;
  available_until: string | null;
  active: boolean;
};

export type Venue = {
  id: string;
  name: string;
  address: string;
  category: "cafe" | "park" | "food" | "activity" | "bookstore";
  lat: number;
  lng: number;
  tags: string[];
  // open/close ("HH:MM", "24:00" = midnight) apply every day unless a day appears in overrides.
  // An override of null means closed all day.
  hours: {
    open: string;
    close: string;
    overrides?: Partial<Record<Day, { open: string; close: string } | null>>;
  };
};

export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

// One item of the GET /api/users response. Public fields only: no coordinates, bio or tags.
export type UserSummary = Pick<
  User,
  "id" | "name" | "handle" | "age" | "gender" | "avatar_url" | "verified"
>;
