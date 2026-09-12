import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { HeartIcon, ChatIcon } from "@/components/icons/icons";
import type { Post } from "@/lib/mock-data";

export function PostCard({ post }: { post: Post }) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={post.author} size={44} />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white">{post.author}</p>
              {post.role !== "Member" && (
                <Badge tone={post.role === "Admin" ? "orange" : "sky"}>{post.role}</Badge>
              )}
            </div>
            <p className="text-xs text-white/45">{post.time}</p>
          </div>
        </div>
        <Badge tone={post.categoryTone}>{post.category}</Badge>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-white/85">{post.content}</p>

      <div className="mt-4 flex items-center gap-5 border-t border-white/10 pt-3">
        <button className="flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <HeartIcon size={30} floaty={false} />
          {post.likes}
        </button>
        <button className="flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <ChatIcon size={30} floaty={false} />
          {post.comments} comments
        </button>
      </div>
    </GlassCard>
  );
}
