import { Topbar } from "@/components/app/Topbar";
import { Composer } from "@/components/app/Composer";
import { PostCard } from "@/components/app/PostCard";
import { RightRail } from "@/components/app/RightRail";
import { posts } from "@/lib/mock-data";

export default function CommunityFeedPage() {
  return (
    <>
      <Topbar title="Community" />
      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Composer />
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
        <RightRail />
      </div>
    </>
  );
}
