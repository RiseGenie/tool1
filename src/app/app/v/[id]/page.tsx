import { VideoPage } from "@/components/rg/VideoPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <VideoPage id={(await params).id} />;
}
