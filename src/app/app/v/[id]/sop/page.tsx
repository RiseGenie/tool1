import { SopEditor } from "@/components/rg/SopEditor";

export const metadata = { title: "SOP" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SopEditor recordingId={(await params).id} />;
}
