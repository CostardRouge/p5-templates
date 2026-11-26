import type {
  Metadata
} from "next";

import SesameCallback from "@/components/SesameCallback";

export const metadata: Metadata = {
  title: "Signing in",
  robots: {
    index: false,
    follow: false
  }
};

/** Where Sésame sends the person back after a sign-in (`src/lib/stockage/session.ts`). */
export default function SesameCallbackPage() {
  return <SesameCallback />;
}
