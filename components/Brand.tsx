import Link from "next/link";

export function LovygoMark({ size = 42 }: { size?: number }) {
  return (
    <span className="lovygo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <defs>
          <linearGradient id="lovygo-heart" x1="9" y1="8" x2="39" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF9ABD" />
            <stop offset=".52" stopColor="#FF4D8D" />
            <stop offset="1" stopColor="#D93678" />
          </linearGradient>
          <linearGradient id="lovygo-thread" x1="13" y1="18" x2="36" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF1F6" />
            <stop offset="1" stopColor="#FF9ABD" />
          </linearGradient>
        </defs>
        <path d="M24 39.1 8.9 24.5C.8 16.3 12.4 5 20.5 13.1L24 16.6l3.5-3.5c8.1-8.1 19.7 3.2 11.6 11.4L24 39.1Z" fill="url(#lovygo-heart)" fillOpacity=".12" stroke="url(#lovygo-heart)" strokeWidth="1.8" />
        <path d="M13.4 23.1c3.2-4.4 7.1-4.4 10.3 0 3.2 4.5 7.3 4.5 10.8 0" stroke="url(#lovygo-thread)" strokeWidth="2.15" strokeLinecap="round" />
        <circle cx="13.4" cy="23.1" r="2.1" fill="#FFF1F6" />
        <circle cx="34.5" cy="23.1" r="2.1" fill="#FF7AAA" />
        <path d="m24 8.5.65 1.75 1.75.65-1.75.65L24 13.3l-.65-1.75-1.75-.65 1.75-.65L24 8.5Z" fill="#FFE5EF" />
      </svg>
    </span>
  );
}

export default function Brand({ href = "/", size = 42, compact = false }: { href?: string; size?: number; compact?: boolean }) {
  return (
    <Link href={href} className="lovygo-brand" aria-label="Lovygo – domů">
      <LovygoMark size={size} />
      {!compact && <span className="lovygo-wordmark">lovygo</span>}
    </Link>
  );
}