/**
 * The build's version, read from the root `package.json` at build time. A named
 * JSON import, so the client bundle carries the string alone, not the whole
 * manifest. `CHANGELOG.md` says what each version brought; `release.yml` tags
 * it on `main` (CLAUDE.md rule 5).
 */
import {
  version
} from "../../package.json";

export const APP_VERSION: string = version;
