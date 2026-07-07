/**
 * Pure label formatting for the montage slide-title overlay. No p5 / browser
 * deps, so it is unit-testable in node (see __tests__/formatTitle.test.ts).
 *
 * Given the variant currently on screen (its slide object, its position in the
 * montage source list and its position in the deck), produce the string to
 * print — e.g. "variante 3", "VERSION B", "slide HERO" or "id f3a9c1".
 */

/**
 * Bijective base-26 alphabet label: 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB …
 * Negative / non-finite indices clamp to 0 (A).
 */
export function toAlphabet(
  index, uppercase = true
) {
  let i = Number.isFinite( index ) ? Math.floor( index ) : 0;

  if ( i < 0 ) {
    i = 0;
  }

  let out = "";

  do {
    out = String.fromCharCode( 65 + ( i % 26 ) ) + out;
    i = Math.floor( i / 26 ) - 1;
  } while ( i >= 0 );

  return uppercase ? out : out.toLowerCase();
}

/**
 * Shorten a durable slide id (`slide_<uuid>`) down to its most-distinctive
 * trailing characters. The `slide_` prefix and any punctuation are dropped, so
 * "slide_2f8c…-a91b" with length 6 becomes the last 6 alphanumerics.
 */
export function shortenSlideId(
  id, length = 6
) {
  if ( typeof id !== "string" ) {
    return "";
  }

  const cleaned = id
    .replace(
      /^slide[_-]/i,
      ""
    )
    .replace(
      /[^a-z0-9]/gi,
      ""
    );

  const n = Number.isFinite( length ) ? Math.max(
    1,
    Math.floor( length )
  ) : 6;

  return cleaned.slice( -n );
}

/**
 * Identifier core (no prefix) for a variant, per the title `mode`.
 *
 * @param {object} subject   - the slide object currently shown
 * @param {number} position  - 0-based index within the montage source list
 * @param {number} deckIndex - 0-based index within the whole deck (name fallback)
 * @param {object} title     - the resolved title options
 */
export function formatTitleCore(
  subject, position, deckIndex, title = {}
) {
  const pos = Number.isFinite( position ) ? position : 0;

  switch ( title.mode ) {
    case "alphabet":
      return toAlphabet(
        pos,
        title.uppercase ?? true
      );

    case "number": {
      const start = Number.isFinite( title.numberStart ) ? title.numberStart : 1;
      const value = String( pos + start );
      const pad = Number.isFinite( title.numberPadding ) ? title.numberPadding : 0;

      return pad > 0 ? value.padStart(
        pad,
        "0"
      ) : value;
    }

    case "id":
      return shortenSlideId(
        subject?.id,
        title.idLength ?? 6
      );

    case "name":
    default: {
      const raw = typeof subject?.name === "string" ? subject.name.trim() : "";
      const fallbackIndex =
        ( Number.isFinite( deckIndex ) ? deckIndex : pos ) + 1;
      const core = raw || `Slide ${ fallbackIndex }`;

      return ( title.uppercase ?? true ) ? core.toUpperCase() : core;
    }
  }
}

/**
 * Full label: optional prefix + identifier core. Returns "" when there is
 * nothing to show.
 */
export function formatSlideTitle(
  subject, position, deckIndex, title = {}
) {
  const core = formatTitleCore(
    subject,
    position,
    deckIndex,
    title
  );

  if ( !title.showPrefix ) {
    return core;
  }

  const prefix = typeof title.prefix === "string" ? title.prefix.trim() : "";

  if ( !prefix ) {
    return core;
  }

  return core ? `${ prefix } ${ core }` : prefix;
}

export default formatSlideTitle;
