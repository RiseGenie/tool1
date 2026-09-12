export type Member = {
  name: string;
  role: "Admin" | "Moderator" | "Member";
  points: number;
  level: number;
  streak: number;
  tag: string;
};

export const members: Member[] = [
  { name: "Ava Chen", role: "Admin", points: 12840, level: 9, streak: 42, tag: "Founder" },
  { name: "Marcus Lee", role: "Moderator", points: 9210, level: 8, streak: 30, tag: "Top Contributor" },
  { name: "Priya Nair", role: "Member", points: 8110, level: 7, streak: 21, tag: "Rising Star" },
  { name: "Jordan Blake", role: "Member", points: 7420, level: 7, streak: 15, tag: "Consistent" },
  { name: "Sofia Reyes", role: "Member", points: 6650, level: 6, streak: 12, tag: "New Wave" },
  { name: "Noah Kim", role: "Member", points: 5980, level: 6, streak: 9, tag: "Helper" },
  { name: "Layla Haddad", role: "Member", points: 5210, level: 5, streak: 8, tag: "Creative" },
  { name: "Ethan Brooks", role: "Member", points: 4870, level: 5, streak: 6, tag: "Grinder" },
  { name: "Mia Torres", role: "Member", points: 4310, level: 4, streak: 5, tag: "Explorer" },
  { name: "Liam Osei", role: "Member", points: 3900, level: 4, streak: 4, tag: "Newcomer" },
];

export type Post = {
  id: string;
  author: string;
  role: Member["role"];
  time: string;
  category: string;
  categoryTone: "orange" | "sky" | "mint" | "pink" | "yellow" | "lavender";
  content: string;
  likes: number;
  comments: number;
  pinned?: boolean;
};

export const posts: Post[] = [
  {
    id: "p1",
    author: "Ava Chen",
    role: "Admin",
    time: "Just now",
    category: "Announcement",
    categoryTone: "orange",
    content:
      "Welcome to Orbit Circle 🚀 — this week we're launching the '30-Day Momentum Challenge'. Drop a comment with your #1 goal and I'll personally cheer you on!",
    likes: 128,
    comments: 34,
    pinned: true,
  },
  {
    id: "p2",
    author: "Marcus Lee",
    role: "Moderator",
    time: "2h ago",
    category: "Win of the Day",
    categoryTone: "mint",
    content:
      "Just hit 1,000 subscribers on my newsletter using the outreach template from Module 3. This community is unreal — thank you all 🙏",
    likes: 76,
    comments: 19,
  },
  {
    id: "p3",
    author: "Priya Nair",
    role: "Member",
    time: "5h ago",
    category: "Question",
    categoryTone: "sky",
    content:
      "Anyone else struggling with pricing their first cohort? Would love feedback on a $299 vs $499 launch price for a 4-week program.",
    likes: 41,
    comments: 27,
  },
  {
    id: "p4",
    author: "Sofia Reyes",
    role: "Member",
    time: "1d ago",
    category: "Resource",
    categoryTone: "pink",
    content:
      "Made a Notion template for tracking daily content ideas — grabbed 40 downloads already. Link in the comments if you want it!",
    likes: 63,
    comments: 22,
  },
  {
    id: "p5",
    author: "Noah Kim",
    role: "Member",
    time: "1d ago",
    category: "Discussion",
    categoryTone: "lavender",
    content:
      "What's the one habit that changed your business the most this year? Mine was time-blocking Fridays for strategy only.",
    likes: 55,
    comments: 31,
  },
];

export type Course = {
  id: string;
  title: string;
  description: string;
  lessons: number;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  progress: number;
  gradient: [string, string];
  modules: { title: string; lessons: { title: string; length: string; done: boolean }[] }[];
};

export const courses: Course[] = [
  {
    id: "c1",
    title: "Community Growth Blueprint",
    description: "A step-by-step system to grow an engaged paid community from 0 to 1,000 members.",
    lessons: 24,
    duration: "6h 40m",
    level: "Beginner",
    progress: 68,
    gradient: ["var(--c-orange)", "var(--c-pink)"],
    modules: [
      {
        title: "Foundations",
        lessons: [
          { title: "Why communities win in 2026", length: "8m", done: true },
          { title: "Choosing your niche", length: "12m", done: true },
          { title: "Setting up your space", length: "10m", done: true },
        ],
      },
      {
        title: "Launch",
        lessons: [
          { title: "Your founding 100 members", length: "18m", done: true },
          { title: "Pricing your community", length: "14m", done: false },
          { title: "Onboarding that sticks", length: "16m", done: false },
        ],
      },
    ],
  },
  {
    id: "c2",
    title: "Content Systems for Creators",
    description: "Batch, repurpose, and distribute content across every platform without burning out.",
    lessons: 18,
    duration: "4h 10m",
    level: "Intermediate",
    progress: 32,
    gradient: ["var(--c-sky)", "var(--c-lavender)"],
    modules: [
      {
        title: "Planning",
        lessons: [
          { title: "The content flywheel", length: "9m", done: true },
          { title: "30-day content calendar", length: "13m", done: true },
        ],
      },
      {
        title: "Production",
        lessons: [
          { title: "Batch recording setup", length: "20m", done: false },
          { title: "Repurposing long-form to shorts", length: "15m", done: false },
        ],
      },
    ],
  },
  {
    id: "c3",
    title: "Monetize Your Expertise",
    description: "Turn your knowledge into digital products, coaching offers, and recurring revenue.",
    lessons: 15,
    duration: "3h 50m",
    level: "Advanced",
    progress: 5,
    gradient: ["var(--c-mint)", "var(--c-sky)"],
    modules: [
      {
        title: "Offer Design",
        lessons: [
          { title: "Finding your signature offer", length: "11m", done: true },
          { title: "Pricing psychology", length: "9m", done: false },
        ],
      },
    ],
  },
];

export type Event = {
  id: string;
  title: string;
  date: string;
  time: string;
  host: string;
  attendees: number;
  tone: "orange" | "sky" | "mint" | "pink" | "yellow" | "lavender";
};

export const events: Event[] = [
  { id: "e1", title: "Live Q&A: Ask Me Anything", date: "Mon, Sep 15", time: "10:00 AM PT", host: "Ava Chen", attendees: 214, tone: "orange" },
  { id: "e2", title: "Workshop: Pricing Your Offer", date: "Wed, Sep 17", time: "1:00 PM PT", host: "Marcus Lee", attendees: 132, tone: "sky" },
  { id: "e3", title: "Community Co-working Sprint", date: "Fri, Sep 19", time: "9:00 AM PT", host: "Priya Nair", attendees: 88, tone: "mint" },
  { id: "e4", title: "Monthly Wins Celebration", date: "Fri, Sep 26", time: "3:00 PM PT", host: "Ava Chen", attendees: 301, tone: "pink" },
];
