/**
 * Where the studio's work goes when the person signs in: his shared store
 * (CostardRouge/stockage, `stockage.steeve.website`), reached with a Sésame
 * access token made for it (CostardRouge/sesame#26).
 *
 * `NEXT_PUBLIC_STOCKAGE` is off by default and baked in at build time, like
 * the other optional features (`docs/memory/architecture.md`): until Sésame
 * issues the tokens and the store is deployed, a sign-in line would only
 * fail. The addresses have production defaults so turning it on is one
 * variable in the Workers Builds settings.
 */
export const STOCKAGE_ENABLED = process.env.NEXT_PUBLIC_STOCKAGE === "true";

export const SESAME_ISSUER = process.env.NEXT_PUBLIC_SESAME_ISSUER || "https://auth.steeve.website";
export const STOCKAGE_URL = process.env.NEXT_PUBLIC_STOCKAGE_URL || "https://stockage.steeve.website";
/** Sketchbook's app id in Sésame: also its namespace in the store (`/api/apps/<id>/…`). */
export const SESAME_CLIENT_ID = process.env.NEXT_PUBLIC_SESAME_CLIENT_ID || "sketchbook";

/** The page Sésame sends the person back to (`src/app/auth/sesame/page.tsx`). Registered in Sésame as is. */
export const CALLBACK_PATH = "/auth/sesame";

/** What the sign-in asks for: who (`openid`), a refresh token, and the store. */
export const SCOPE = "openid offline_access stockage";
