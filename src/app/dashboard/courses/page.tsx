import { Topbar } from "@/components/app/Topbar";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { CourseIcon, PlayIcon } from "@/components/icons/icons";
import { courses } from "@/lib/mock-data";
import Link from "next/link";

const levelTone = {
  Beginner: "mint",
  Intermediate: "sky",
  Advanced: "pink",
} as const;

export default function CoursesPage() {
  return (
    <>
      <Topbar title="Classroom" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => (
          <Link key={course.id} href={`/dashboard/courses/${course.id}`}>
            <GlassCard className="flex h-full flex-col p-5 transition-transform duration-300 hover:-translate-y-1.5">
              <div
                className="relative flex h-32 items-center justify-center overflow-hidden rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${course.gradient[0]}, ${course.gradient[1]})`,
                }}
              >
                <CourseIcon size={72} />
                <div className="absolute right-3 top-3">
                  <PlayIcon size={36} floaty={false} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Badge tone={levelTone[course.level]}>{course.level}</Badge>
                <span className="text-xs text-white/50">
                  {course.lessons} lessons · {course.duration}
                </span>
              </div>

              <h3 className="mt-3 text-lg font-bold text-white">{course.title}</h3>
              <p className="mt-1.5 flex-1 text-sm text-white/60">{course.description}</p>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-white/55">
                  <span>Progress</span>
                  <span>{course.progress}%</span>
                </div>
                <ProgressBar value={course.progress} />
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </>
  );
}
