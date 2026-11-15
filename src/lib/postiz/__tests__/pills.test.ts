/**
 * A caption as pills: the grammar, each pill's value, and the words each
 * network receives.
 */

import {
  captionLength, composeCaption, DEFAULT_PHRASES, emptyPills, formatDate, paletteOf, parseTemplate, pillDef, serializeTemplate, type PillContext
} from "../pills";

const facts = {
  title: "Iridescent · Peaks shell",
  sketch: "iridescent-v7-peaks-shell",
  description: "A spiny seashell — a spiral tube that widens turn after turn from a fine apex to an open mouth, its outer side armed with needles gathered into three combs like a murex, hair-thin at the top and long at the bottom — turning slowly on a pale blue-grey ground while the spines sway in a wave. Surfaces are coloured by the iridescent ramp, which shifts with the viewing angle.",
  tags: "#3d #mesh #iridescent #geometry #orbit #colourful",
  engine: "p5.js",
  seconds: "12",
  link: "p5.steeve.website/sketches/p5/iridescent/iridescent-v7-peaks-shell",
  category: "Iridescent",
  categorySlug: "iridescent",
  version: 7,
  rank: 7,
  of: 7,
  created: "2026-11-10T14:11:06.242Z",
  fps: "30",
  slides: 1,
  postNo: 24,
  catNo: 3,
  note: ""
};
const ctx = ( patch: Partial<PillContext> = {} ): PillContext => ( {
  facts,
  at: new Date( "2026-11-15T09:00:00Z" ),
  timeZone: "Europe/Paris",
  dayStart: "2026-10-01",
  phrases: DEFAULT_PHRASES,
  ...patch
} );
const SHARED = "{title}\n{description}\n\n{engine} · {loop} · {link}\n{tags} {phrase:house}";

describe(
  "the pill grammar",
  () => {
    it(
      "reads and writes tokens with options, and leaves an unknown one as typed",
      () => {
        const t = "{catNo} · {title|case=upper}\n{date|fmt=long} {nope}";
        const segs = parseTemplate( t );

        expect( segs ).toEqual( [
          {
            pill: "catNo",
            opts: {}
          },
          {
            text: " · "
          },
          {
            pill: "title",
            opts: {
              case: "upper"
            }
          },
          {
            text: "\n"
          },
          {
            pill: "date",
            opts: {
              fmt: "long"
            }
          },
          {
            text: " "
          },
          {
            pill: "nope",
            opts: {}
          }
        ] );
        expect( serializeTemplate( segs ) ).toBe( t );
        expect( composeCaption(
          t,
          ctx(),
          null
        ).text ).toBe( "Iridescent #3 · IRIDESCENT · PEAKS SHELL\nSunday 15 November {nope}" );
      }
    );

    it(
      "keeps the templates written before the pills",
      () => {
        expect( composeCaption(
          "{title} — {engine}, a {seconds} s loop\n{link}",
          ctx(),
          null
        ).text ).toBe( "Iridescent · Peaks shell — p5.js, a 12 s loop\np5.steeve.website/sketches/p5/iridescent/iridescent-v7-peaks-shell" );
      }
    );

    it(
      "offers every pill but the legacy ones, his phrases last",
      () => {
        const keys = paletteOf( DEFAULT_PHRASES ).map( ( p ) => p.key );

        expect( keys ).not.toContain( "seconds" );
        expect( keys.slice( -3 ) ).toEqual( [
          "phrase:house",
          "phrase:inbio",
          "phrase:sign"
        ] );
        expect( pillDef(
          "phrase:house",
          DEFAULT_PHRASES
        )?.tags ).toBe( true );
      }
    );
  }
);

describe(
  "each pill's value",
  () => {
    it(
      "says the sketch, the piece and the post in his rhythm's zone",
      () => {
        const value = (
          k: string, opts: Record<string, string> = {}
        ) => pillDef(
          k,
          DEFAULT_PHRASES
        )!.value(
          ctx(),
          opts
        );

        expect( value( "rank" ) ).toBe( "7th of 7 in Iridescent" );
        expect( value( "version" ) ).toBe( "v7" );
        expect( value( "categoryTag" ) ).toBe( "#iridescent" );
        expect( value( "engineTag" ) ).toBe( "#p5js" );
        expect( value( "descriptionFirst" ) ).toMatch( /viewing angle\.$|wave\.$/ );
        expect( value(
          "tags",
          {
            count: "2"
          }
        ) ).toBe( "#3d #mesh" );
        expect( value(
          "created",
          {
            fmt: "num"
          }
        ) ).toBe( "10/11/2026" );
        expect( value( "weekday" ) ).toBe( "Sunday" );
        expect( value( "season" ) ).toBe( "Autumn 2026" );
        expect( value( "dayN" ) ).toBe( "Day 46" );
        expect( value( "postNo" ) ).toBe( "Sketchbook #24" );
        expect( formatDate(
          new Date( "2026-11-15T23:30:00Z" ),
          "short",
          "Europe/Paris"
        ) ).toBe( "16 Nov" );
      }
    );
  }
);

describe(
  "what each network receives",
  () => {
    it(
      "says the link as «link in bio» on Instagram and TikTok, and keeps it elsewhere",
      () => {
        expect( composeCaption(
          SHARED,
          ctx(),
          "instagram"
        ).text ).toContain( "p5.js · a 12 s loop · Full loop: link in bio" );
        expect( composeCaption(
          "{link|inbio=off}",
          ctx(),
          "instagram"
        ).text ).toBe( facts.link );
        expect( composeCaption(
          SHARED,
          ctx(),
          "bluesky"
        ).text ).toContain( facts.link );
      }
    );

    it(
      "keeps each hashtag once, within the network's count",
      () => {
        const t = "{categoryTag} {tags} {engineTag} {phrase:house}";

        expect( composeCaption(
          t,
          ctx(),
          "instagram"
        ).text ).toBe( "#iridescent #3d #mesh #geometry #orbit #colourful #p5js #generativeart #creativecoding" );
        expect( composeCaption(
          t,
          ctx(),
          "threads"
        ) ).toMatchObject( {
          text: "#iridescent",
          notes: [
            "1 of 9 hashtags"
          ]
        } );
        expect( composeCaption(
          t,
          ctx(),
          "x"
        ).text ).toBe( "#iridescent #3d" );
      }
    );

    it(
      "fits X: the description goes first, the link counts 23",
      () => {
        const x = composeCaption(
          SHARED,
          ctx(),
          "x"
        );

        expect( x.over ).toBe( false );
        expect( x.length ).toBeLessThanOrEqual( 280 );
        expect( x.notes ).toEqual( [
          "2 of 8 hashtags",
          "description dropped"
        ] );
        expect( x.text ).toBe( `Iridescent · Peaks shell\n\np5.js · a 12 s loop · ${ facts.link }\n#3d #mesh` );
        expect( captionLength(
          facts.link,
          "x"
        ) ).toBe( 23 );
      }
    );

    it(
      "folds away a line whose pills are empty for this sketch",
      () => {
        const bare = ctx( {
          facts: {
            ...facts,
            description: "",
            tags: "",
            note: ""
          }
        } );

        expect( composeCaption(
          "{title}\n{note}\n{description}\n{catNo} · {link|inbio=off}",
          bare,
          "threads"
        ).text ).toBe( `Iridescent · Peaks shell\nIridescent #3 · ${ facts.link }` );
        expect( emptyPills(
          "{title} {note} {description}",
          bare
        ) ).toEqual( [
          "note",
          "description"
        ] );
      }
    );

    it(
      "hides a pill on the networks it is not shown on",
      () => {
        const t = "{title}\n{phrase:sign|nets=instagram,tiktok}";

        expect( composeCaption(
          t,
          ctx(),
          "instagram"
        ).text ).toBe( "Iridescent · Peaks shell\nMade with Sketchbook" );
        expect( composeCaption(
          t,
          ctx(),
          "x"
        ).text ).toBe( "Iridescent · Peaks shell" );
      }
    );
  }
);
