import {
  readFileSync
} from "node:fs";
import {
  join
} from "node:path";
import {
  APP_VERSION
} from "@/lib/version";

describe(
  "APP_VERSION",
  () => {
    it(
      "is the root package.json's version",
      () => {
        const manifest = JSON.parse( readFileSync(
          join(
            __dirname,
            "../../../package.json"
          ),
          "utf8"
        ) );

        expect( APP_VERSION ).toBe( manifest.version );
        expect( APP_VERSION ).toMatch( /^\d+\.\d+\.\d+$/ );
      }
    );
  }
);
