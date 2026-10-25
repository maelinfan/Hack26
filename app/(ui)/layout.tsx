import BottomNav from "@/components/BottomNav";
import AuthGate from "@/components/AuthGate";

// Pages render after the per-tab session loads (sessionStorage), so they can't be "instant" in Next's
// validation sense. Opt out so the dev overlay doesn't flag every route.
export const instant = false;

export default function UILayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-white">
      <AuthGate nav={<BottomNav />}>{children}</AuthGate>
    </div>
  );
}
