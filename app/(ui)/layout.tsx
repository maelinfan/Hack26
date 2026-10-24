import BottomNav from "@/components/BottomNav";
import AuthGate from "@/components/AuthGate";

export default function UILayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-white">
      <AuthGate nav={<BottomNav />}>{children}</AuthGate>
    </div>
  );
}
