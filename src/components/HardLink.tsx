import React, {
} from "react";

// HardLink forces a full page reload (no client routing)
function HardLink( {
  href, className, children, active
}: {
 href: string; className?: string; children: React.ReactNode, active: boolean
} ) {
  return (
    <a
      href={href}
      className={className}
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

export default HardLink;