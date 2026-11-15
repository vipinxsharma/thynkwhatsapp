import Image from "next/image";

type LogoSize = "nav" | "sidebar" | "login" | "footer";

const frames: Record<LogoSize, string> = {
  nav: "h-[72px] w-36 rounded-xl",
  sidebar: "h-14 w-28 rounded-lg",
  login: "h-[120px] w-60 rounded-2xl",
  footer: "h-[120px] w-60 rounded-2xl",
};

export function XeccelLogo({ size = "nav", priority = false }: { size?: LogoSize; priority?: boolean }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden bg-[#04132e] ${frames[size]}`}>
      <Image
        src="/brand/xeccel-logo-horizontal.png"
        alt="Xeccel logo with Powered by thynkWISE lockup"
        fill
        priority={priority}
        sizes={size === "nav" ? "144px" : size === "sidebar" ? "112px" : "240px"}
        className="object-contain"
      />
    </span>
  );
}
