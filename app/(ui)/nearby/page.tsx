import NearbyView from "./NearbyView";

// Server wrapper: `instant` can't be exported from a Client Component. The view waits for the per-tab
// session (sessionStorage), so it can't be "instant" in Next's validation sense.
export const instant = false;

export default function NearbyPage() {
  return <NearbyView />;
}
