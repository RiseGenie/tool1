import { Topbar } from "@/components/app/Topbar";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { PlayIcon, CheckIcon, CourseIcon } from "@/components/icons/icons";
import { courses } from "@/lib/mock-data";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return courses.map((c) => ({ courseId: c.id }));
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = courses.find((c) => c.id === courseId);
  if (!course) notFound();

  return (
    <>
      <Topbar title={course.title} />
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <GlassCard
            className="relative flex h-64 items-center justify-center overflow-hidden sm:h-80"
            style={{
              background: `linear-gradient(135deg, ${course.gradient[0]}, ${course.gradient[1]})`,
            }}
          >
            <button className="glass flex h-20 w-20 items-center justify-center rounded-full">
              <PlayIcon size={64} />
            </button>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <Badge tone="lavender">{course.level}</Badge>
              <span className="text-xs text-white/50">
                {course.lessons} lessons · {course.duration}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              {course.description}
            </p>
          </GlassCard>
        </div>

        <div className="w-full shrink-0 lg:w-96">
          <GlassCard className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <CourseIcon size={36} floaty={false} />
              <p className="font-semibold text-white">Course content</p>
            </div>
            <div className="mb-4">
              <div className="mb-1 flex justify-between text-xs text-white/55">
                <span>Overall progress</span>
                <span>{course.progress}%</span>
              </div>
              <ProgressBar value={course.progress} />
            </div>

            <div className="flex flex-col gap-4">
              {course.modules.map((mod) => (
                <div key={mod.title}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/45">
                    {mod.title}
                  </p>
                  <div className="flex flex-col gap-1">
                    {mod.lessons.map((lesson) => (
                      <div
                        key={lesson.title}
                        className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 hover:bg-white/5"
                      >
                        <div className="flex items-center gap-2.5">
                          {lesson.done ? (
                            <CheckIcon size={26} floaty={false} />
                          ) : (
                            <PlayIcon size={26} floaty={false} />
                          )}
                          <span className="text-sm text-white/80">{lesson.title}</span>
                        </div>
                        <span className="text-xs text-white/40">{lesson.length}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </>
  );
}
