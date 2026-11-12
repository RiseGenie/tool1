export type Category = "automation" | "marketing" | "creative" | "growth";

export const CATEGORIES: { id: "all" | Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "automation", label: "Automation" },
  { id: "marketing", label: "Marketing" },
  { id: "creative", label: "Creative" },
  { id: "growth", label: "Growth" },
];

export const SERVICES: {
  title: string;
  blurb: string;
  cat: Category;
  color: string;
  icon: string;
  cta: string;
}[] = [
  { title: "Business Automation Platform", blurb: "Automate every step of your sales and marketing with unlimited possibilities and intelligent workflows.", cat: "automation", color: "var(--green)", icon: "⚙", cta: "Explore RiseGenie Automation" },
  { title: "Landing Pages & Funnels", blurb: "High-converting landing pages and sales funnels built with GoHighLevel expertise that turn visitors into paying customers.", cat: "automation", color: "var(--yellow)", icon: "▼", cta: "Learn more" },
  { title: "AI Calling Agent", blurb: "Inbound and outbound human-like voice calls. Nurture leads, set appointments and follow up without picking up the phone.", cat: "automation", color: "var(--pink)", icon: "☎", cta: "Learn more" },
  { title: "Social Media Management", blurb: "Strategic organic growth through expert page management and community engagement that expands your audience authentically.", cat: "marketing", color: "var(--blue)", icon: "♥", cta: "Learn more" },
  { title: "Paid Advertising (PPC)", blurb: "Precision-targeted ad campaigns optimized for maximum ROI. We make every dollar of your ad spend count.", cat: "marketing", color: "var(--orange)", icon: "$", cta: "Learn more" },
  { title: "Email Marketing", blurb: "Personalized, impactful email campaigns that nurture leads and drive conversions through strategic automation.", cat: "marketing", color: "var(--green)", icon: "✉", cta: "Learn more" },
  { title: "Graphics & Branding", blurb: "Stunning visual identity that captures your brand essence and creates lasting impressions with your audience.", cat: "creative", color: "var(--pink)", icon: "✦", cta: "Learn more" },
  { title: "Web Design & Development", blurb: "Powerful online presence with websites that are visually striking, highly functional, and user-centric.", cat: "creative", color: "var(--yellow)", icon: "▣", cta: "Learn more" },
  { title: "SEO & Keyword Research", blurb: "Comprehensive SEO audits and keyword strategies that boost your search rankings and organic visibility.", cat: "growth", color: "var(--blue)", icon: "⌕", cta: "Learn more" },
  { title: "Backlink Generation", blurb: "Quality backlink audits and generation strategies that strengthen your site authority and domain ranking.", cat: "growth", color: "var(--orange)", icon: "∞", cta: "Learn more" },
  { title: "B2B Lead Generation", blurb: "Targeted lead generation that fills your pipeline with qualified prospects ready to become loyal customers.", cat: "growth", color: "var(--green)", icon: "◎", cta: "Learn more" },
  { title: "Content Strategy", blurb: "Compelling content that aligns with your brand voice and drives meaningful engagement with your audience.", cat: "creative", color: "var(--yellow)", icon: "¶", cta: "Learn more" },
];

export const PILLARS = [
  { title: "Intelligent Automation", body: "Streamline workflows with AI-powered automation for repetitive tasks.", color: "var(--green)" },
  { title: "Precision Targeting", body: "Reach ideal customers with data-driven targeting strategies.", color: "var(--yellow)" },
  { title: "Scalable Solutions", body: "Systems that grow with your business from startup to enterprise.", color: "var(--pink)" },
  { title: "Trusted Results", body: "Join 100+ satisfied clients with proven strategies.", color: "var(--blue)" },
];

export const TESTIMONIALS = [
  { name: "Maya Thompson", role: "Business Coach", stat: "+35% ROI", quote: "RiseGenie transformed my chaotic marketing into streamlined automation that saves me 8+ hours weekly. My campaign ROI improved by 35%, and their ongoing support keeps me ahead of trends. A reliable partner for coaches prioritizing growth.", color: "var(--green)" },
  { name: "Carlos Ramirez", role: "Marketing Consultant", stat: "+50% opens", quote: "Their expertise in segmentation and automation elevated my client engagement strategy. Personalized email sequences boosted open rates by 50% and conversions by 20%. Highly recommended for data-driven marketers.", color: "var(--yellow)" },
  { name: "Emily Carter", role: "Life Coach", stat: "-60% manual work", quote: "RiseGenie's CRM integration brought clarity to my marketing efforts. They streamlined client onboarding and automated follow-ups, reducing manual tasks by 60%. Their solutions are scalable and practical.", color: "var(--pink)" },
  { name: "James Mitchell", role: "Executive Coach", stat: "+25% conversion", quote: "They unified my brand messaging across campaigns while maintaining a personal touch. Lead-to-client conversion increased by 25% and freed up time for high-value coaching. Professional and delivers measurable results.", color: "var(--blue)" },
];

export const TEAM = [
  { name: "Chandan Mitra", role: "Director of Product", initials: "CM", color: "var(--green)", bio: "Drives Funnel Boss CRM development. Founded RiseGenie to enhance digital presence through strategic marketing. MBA holder with prestigious academic honors including the Jamshed Ji Tata Memorial Gold Medal.", skills: ["GoHighLevel", "ClickFunnels", "Product Management", "Digital Marketing", "SMM", "Strategy Development"] },
  { name: "Ankita Sarkar", role: "Design & Finance", initials: "AS", color: "var(--pink)", bio: "Oversees all design services with a creative vision that transforms client ideas into compelling visual content. Expert in financial planning and strategic resource allocation ensuring fiscal excellence.", skills: ["Graphic Design", "Brand Strategy", "Financial Planning", "Creative Direction"] },
];

export const TOOLS = [
  { title: "SEO Audit", body: "See how your site ranks and what to fix first.", href: "https://seoauditapp.in/", color: "var(--blue)" },
  { title: "A2P Success", body: "Get your SMS campaigns registered and approved.", href: "https://live.a2psuccess.com/", color: "var(--yellow)" },
  { title: "Ad ROI Calculator", body: "Know what your ad spend should return.", href: "https://roi.risegenie.in/", color: "var(--pink)" },
];

export const NAV = [
  { id: "services", label: "Services" },
  { id: "about", label: "About" },
  { id: "testimonials", label: "Results" },
  { id: "team", label: "Team" },
  { id: "tools", label: "Free Tools" },
  { id: "contact", label: "Contact" },
];

export const SOCIALS = [
  { label: "LinkedIn", href: "https://linkedin.com/company/risegenie/" },
  { label: "Facebook", href: "https://www.facebook.com/risegenie.llc" },
  { label: "Instagram", href: "https://www.instagram.com/risegenie.llc/" },
  { label: "YouTube", href: "https://www.youtube.com/@risegenie" },
  { label: "X", href: "https://x.com/Risegenie1" },
];

export const CONTACT = {
  email: "support@risegenie.com",
  phone: "+1 505-636-3737",
  address: "5203 Juan Tabo Blvd STE 2B, Albuquerque, NM 87111",
};
