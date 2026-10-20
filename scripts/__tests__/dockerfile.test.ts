import fs from "fs";
import path from "path";

/**
 * The Dockerfile's three stages start from Microsoft's Playwright image, and
 * the browser that image bundles must be the one the locked `playwright`
 * package drives: the two drifted apart for weeks (1.59.1 image, 1.62.0
 * client) before anything said so. A bump of either side alone fails here, so
 * a Dependabot pull request (npm or docker) stays red until the other side is
 * pushed onto its branch — see docs/memory/deployment.md.
 */
const root = path.resolve(
  __dirname,
  "..",
  ".."
);

function lockedPlaywrightVersion(): string {
  const lock = JSON.parse( fs.readFileSync(
    path.join(
      root,
      "package-lock.json"
    ),
    "utf8"
  ) );

  return lock.packages[ "node_modules/playwright" ].version;
}

function dockerfileImageVersions(): string[] {
  const dockerfile = fs.readFileSync(
    path.join(
      root,
      "Dockerfile"
    ),
    "utf8"
  );

  return [
    ...dockerfile.matchAll( /^FROM mcr\.microsoft\.com\/playwright:v([0-9.]+)-jammy\b/gm )
  ].map( ( match ) => match[ 1 ] );
}

describe(
  "Dockerfile",
  () => {
    it(
      "starts every stage from the Playwright image of the locked playwright package",
      () => {
        const versions = dockerfileImageVersions();

        expect( versions ).toHaveLength( 3 );
        expect( new Set( versions ) ).toEqual( new Set( [
          lockedPlaywrightVersion()
        ] ) );
      }
    );
  }
);
