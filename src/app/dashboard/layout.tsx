import { Sidebar } from "@/components/app/Sidebar";
import { MobileNav } from "@/components/app/MobileNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl gap-4 p-4 pb-28 lg:pb-4">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col gap-4">{children}</main>
      <MobileNav />
    </div>
  );
}
