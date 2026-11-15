/**
 * The «Post #» and «Category #» pills: this send's number among his
 * Sketchbook sends kept by this browser, and among this category's. A draft
 * is not a post; a send taken back is forgotten and no longer counts.
 *
 * Pure: the kept sends (`allPublications`) and a way to read a sketch key's
 * category in; the next numbers out.
 */

import type {
  Publication
} from "./publishStore";

export function sendNumbers(
  all: readonly { key: string;
    publication: Publication }[],
  categoryOf: ( key: string ) => string | null,
  category: string | null
): { postNo: number;
  catNo: number | null } {
  const sent = all.filter( ( s ) => s.publication.target !== "draft" );

  return {
    postNo: sent.length + 1,
    catNo: category ? sent.filter( ( s ) => categoryOf( s.key ) === category ).length + 1 : null
  };
}
