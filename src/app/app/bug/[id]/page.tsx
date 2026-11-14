import { BugEditor } from "@/components/rg/BugEditor";

export const metadata = { title: "Bug report" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <BugEditor id={(await params).id} />;
}
