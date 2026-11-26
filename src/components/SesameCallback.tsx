"use client";

import Link from "next/link";
import {
  useRouter
} from "next/navigation";
import {
  useEffect, useRef, useState
} from "react";

import {
  completeSignIn
} from "@/lib/stockage/session";

/**
 * Finishes a Sésame sign-in in this tab — the code exchanged for tokens by
 * the page itself — then returns to where it started. Runs once, even under
 * StrictMode's double effect: a code is single use.
 */
export default function SesameCallback() {
  const router = useRouter();
  const started = useRef( false );
  const [
    problem,
    setProblem
  ] = useState<string | null>( null );

  useEffect(
    () => {
      if ( started.current ) {
        return;
      }
      started.current = true;
      completeSignIn( new URL( window.location.href ) ).then(
        ( back ) => router.replace( back ),
        ( error: unknown ) => setProblem( error instanceof Error ? error.message : String( error ) )
      );
    },
    [
      router
    ]
  );

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-xl font-semibold text-foreground">{problem ? "The sign-in did not finish" : "Signing in with Sésame…"}</h1>
        {problem && (
          <>
            <p className="text-sm text-foreground/70">{problem}</p>
            <Link href="/" className="text-sm underline underline-offset-2">Back to Sketchbook</Link>
          </>
        )}
      </div>
    </main>
  );
}
