import { Watch } from "@/components/clips/Watch";

export default async function WatchPage({ params }: PageProps<"/clips/watch/[id]">) {
  const { id } = await params;
  return <Watch id={id} />;
}
