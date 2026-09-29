import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export default function IconField({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="icon-field">
      <span className="icon-field-symbol" aria-hidden="true"><Icon size={17} /></span>
      {children}
    </span>
  );
}