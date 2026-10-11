// Where a finding came from, read from its URL (a fixed rule, not the model). Client-safe.
// Social first: owners' own words are the point of the Research Agent.

export type Channel = { id: string; label: string; social: boolean; dot: string }

// Social searches each target ONE platform group, so Reddit cannot crowd out the rest.
// Probed with Linkup on 2026-10-11: these return usable page text. YouTube returns titles/descriptions only;
// Instagram, Weibo and Xiaohongshu returned little or nothing, so they are left out.
export const PLATFORMS = {
  reddit: { label: "Reddit", domains: ["reddit.com"] },
  forums: { label: "Owner forums", domains: ["bimmerpost.com", "bimmerfest.com", "mbworld.org", "audizine.com", "motor-talk.de"] },
  x: { label: "X", domains: ["x.com", "twitter.com"] },
  video: { label: "YouTube and TikTok", domains: ["youtube.com", "tiktok.com"] },
  facebook: { label: "Facebook", domains: ["facebook.com"] },
  china: { label: "Chinese car communities", domains: ["autohome.com.cn", "dongchedi.com"] },
} as const
export type PlatformId = keyof typeof PLATFORMS
// Order the server uses when it must pick (or add) a platform.
export const PLATFORM_ORDER: PlatformId[] = ["reddit", "forums", "x", "video", "china", "facebook"]

export const SOCIAL_DOMAINS = Object.values(PLATFORMS).flatMap((p) => [...p.domains])

const RULES: [RegExp, Omit<Channel, "social"> & { social?: boolean }][] = [
  [/(^|\.)reddit\.com$/, { id: "reddit", label: "Reddit", dot: "bg-[#ff4500]" }],
  [/(^|\.)(x|twitter)\.com$/, { id: "x", label: "X", dot: "bg-foreground" }],
  [/(^|\.)tiktok\.com$/, { id: "tiktok", label: "TikTok", dot: "bg-[#25f4ee]" }],
  [/(^|\.)facebook\.com$/, { id: "facebook", label: "Facebook", dot: "bg-[#1877f2]" }],
  [/(^|\.)(youtube\.com|youtu\.be)$/, { id: "youtube", label: "YouTube", dot: "bg-[#ff0000]" }],
  [/(^|\.)instagram\.com$/, { id: "instagram", label: "Instagram", dot: "bg-[#e1306c]" }],
  [/(^|\.)(autohome\.com\.cn|dongchedi\.com|weibo\.com|xiaohongshu\.com)$/, { id: "cn-social", label: "China social", dot: "bg-[#e60012]" }],
  [/(bimmerpost|bimmerfest|mbworld|audizine|motor-talk|forum)/, { id: "forum", label: "Owner forum", dot: "bg-simulated" }],
]

const BY_TYPE: Record<string, Channel> = {
  official_spec: { id: "maker", label: "Maker site", social: false, dot: "bg-muted-foreground" },
  press: { id: "press", label: "Press", social: false, dot: "bg-muted-foreground" },
  review: { id: "review", label: "Review", social: false, dot: "bg-muted-foreground" },
  analysis: { id: "study", label: "Study", social: false, dot: "bg-muted-foreground" },
  forum_post: { id: "forum", label: "Owner forum", social: true, dot: "bg-simulated" },
}

export function channelOf(url: string, sourceType?: string | null): Channel {
  let host = ""
  try {
    host = new URL(url).hostname.replace(/^www\./, "")
  } catch {}
  for (const [re, c] of RULES) if (re.test(host)) return { social: true, ...c }
  return BY_TYPE[sourceType ?? ""] ?? { id: "web", label: "Web", social: false, dot: "bg-muted-foreground" }
}
