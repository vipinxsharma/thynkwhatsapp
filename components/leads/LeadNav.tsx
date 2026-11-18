import Link from "next/link";

const tabs = [
  { key: "list", label: "Lead list", href: "/leads" },
  { key: "board", label: "Stage board", href: "/leads/board" },
] as const;

export function LeadNav({ active }: { active: "list" | "board" }) {
  return (
    <nav aria-label="Lead views" className="flex gap-2 border-b border-white/5">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 pb-3 text-sm font-medium ${
            active === tab.key
              ? "border-whatsapp text-white"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
