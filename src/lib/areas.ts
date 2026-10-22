/**
 * Rule 7 / MASTER_SPEC §1 — the canonical 20 authenticated route areas, the
 * shell groups they live in, and the palette quick actions. Kept free of React
 * and icon imports so the release gate can verify the registry in Node.
 */

export type ShellGroup = "Workspace" | "Content" | "Website" | "Settings" | "Account";

export type Area = {
  id: string;
  group: ShellGroup;
  href: string;
  label: string;
  /** Lucide icon name resolved by the shell (kept as a string so this module stays pure). */
  icon: string;
};

export const AREAS: Area[] = [
  { id: "workspaces", group: "Workspace", href: "/workspaces", label: "Websites", icon: "Globe" },
  { id: "overview", group: "Content", href: "/", label: "Overview", icon: "LayoutDashboard" },
  { id: "create", group: "Content", href: "/create", label: "Create", icon: "PenLine" },
  { id: "topic-plans", group: "Content", href: "/topic-plans", label: "Topic Plans", icon: "ListTree" },
  { id: "research", group: "Content", href: "/research", label: "Research", icon: "BookOpen" },
  { id: "calendar", group: "Content", href: "/calendar", label: "Calendar", icon: "CalendarDays" },
  { id: "runs", group: "Content", href: "/runs", label: "Runs", icon: "Activity" },
  { id: "articles", group: "Content", href: "/articles", label: "Articles", icon: "Files" },
  { id: "analytics", group: "Website", href: "/analytics", label: "Analytics", icon: "ChartColumn" },
  { id: "connections", group: "Website", href: "/connections", label: "Connections", icon: "Cable" },
  { id: "static-delivery", group: "Website", href: "/static-delivery", label: "Static Delivery", icon: "Rocket" },
  { id: "authors", group: "Website", href: "/authors", label: "Authors & Bylines", icon: "Users" },
  { id: "ai-keys", group: "Settings", href: "/ai-keys", label: "AI Keys & Usage", icon: "KeyRound" },
  { id: "content-defaults", group: "Settings", href: "/settings/content", label: "Content Defaults", icon: "SlidersHorizontal" },
  { id: "website-settings", group: "Settings", href: "/settings/website", label: "Website Settings", icon: "Settings2" },
  { id: "backup", group: "Settings", href: "/settings/website#backup", label: "Backup & Recovery", icon: "ArchiveRestore" },
  { id: "inbox", group: "Settings", href: "/inbox", label: "Funding / Inbox", icon: "Inbox" },
  { id: "account", group: "Account", href: "/account", label: "Account", icon: "UserRound" },
  { id: "billing", group: "Account", href: "/billing", label: "Billing & Plan", icon: "CreditCard" },
  { id: "help", group: "Account", href: "/help", label: "Help", icon: "CircleHelp" },
];

export const SHELL_GROUPS: ShellGroup[] = ["Workspace", "Content", "Website", "Settings", "Account"];

export const NAV_AREAS = AREAS;

export const PALETTE_ACTIONS = [
  { id: "new-batch", label: "New Keyword Batch", hint: "Action", href: "/create", build: false },
  { id: "new-research", label: "New Research Project", hint: "Action", href: "/research", build: false },
  { id: "calendar-automation", label: "Open Calendar Automation", hint: "Action", href: "/calendar", build: false },
  { id: "build-static", label: "Build Static Site", hint: "Action", href: "/static-delivery", build: true },
] as const;

/**
 * Maps an area href onto the TanStack route file that serves it.
 * Used by the release gate to prove every registered area resolves.
 */
export function routeFileCandidates(href: string): string[] {
  href = href.split("#", 1)[0]!;
  if (href === "/") return ["src/routes/index.tsx"];
  const trimmed = href.replace(/^\//, "");
  if (trimmed.includes("/")) {
    const [head, ...rest] = trimmed.split("/");
    return [`src/routes/${head}.${rest.join(".")}.tsx`, `src/routes/${trimmed}.tsx`];
  }
  return [`src/routes/${trimmed}.index.tsx`, `src/routes/${trimmed}.tsx`];
}
