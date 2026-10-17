/**
 * The build's version, read from the root `package.json` at build time.
 * SERVER-side only: a client component importing this would ship the whole
 * package.json in its chunk (measured — the bundler keeps every key), so the
 * home page reads it and hands the string to `HomePage` as a prop.
 * `CHANGELOG.md` says what each version brought; `release.yml` tags it on
 * `main` (CLAUDE.md rule 5).
 */
import {
  version
} from "../../package.json";

export const APP_VERSION: string = version;
