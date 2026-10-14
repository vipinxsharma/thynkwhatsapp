import Image from "next/image";

type LogoSize = "nav" | "sidebar" | "login" | "hero" | "footer";

const frames: Record<LogoSize, string> = {
  nav: "h-14 w-36 rounded-xl",
  sidebar: "h-12 w-28 rounded-lg",
  login: "h-24 w-60 rounded-2xl",
  hero: "aspect-[4/3] w-full rounded-[1.35rem]",
  footer: "h-24 w-60 rounded-2xl",
};

export function XeccelLogo({ size = "nav", priority = false }: { size?: LogoSize; priority?: boolean }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden bg-[#04132e] ${frames[size]}`}>
      <Image
        src="/brand/xeccel-logo.jpg"
        alt="Xeccel logo with Powered by thynkWISE lockup"
        fill
        priority={priority}
        sizes={size === "hero" ? "(max-width: 768px) 100vw, 40vw" : size === "nav" ? "144px" : size === "sidebar" ? "112px" : "240px"}
        className="object-cover"
        style={{ objectPosition: "center 32%" }}
      />
    </span>
  );
}
