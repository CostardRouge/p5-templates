"use client";

import Link from "next/link";

import {
  getEngineLabel
} from "@/engines/engineCatalog";

type Props = {
  engineId: string;
  name: string;
  category?: string | null;
  activeSlideIndex?: number;
};

/**
 * Breadcrumb displayed above the sketch preview canvas.
 *
 * Renders: <engine> · <category?> · <name> ( · slide <n>?)
 *   - engine    → /sketches/<engineId>
 *   - category  → /sketches/<engineId>?category=<category>
 *   - name      → /sketches/<engineId>/<category?>/<name>
 *
 * The category segment is skipped when the sketch has no category.
 *
 * The links navigate in the SAME tab, like every internal link. They used to
 * open a new tab, and on a phone this breadcrumb is the sketch page's only way
 * back to the library: the new tab started with no history, so the browser's
 * Back closed it instead of returning to the list or the home page. A new tab
 * is still one long-press / middle-click away.
 */
export default function SketchBreadcrumb( {
  engineId,
  name,
  category,
  activeSlideIndex
}: Props ) {
  const engineLabel = getEngineLabel( engineId );
  const sketchHref = category
    ? `/sketches/${ engineId }/${ category }/${ name }`
    : `/sketches/${ engineId }/${ name }`;

  return (
    <p className="truncate">
      <Link
        href={ `/sketches/${ engineId }` }
      >
        {engineLabel}
      </Link>

      {category && (
        <>
          <span className="text-xs">{" · "}</span>
          <Link
            href={ `/sketches/${ engineId }?category=${ encodeURIComponent( category ) }` }
          >
            {category}
          </Link>
        </>
      )}

      <span className="text-xs">{" · "}</span>
      <Link
        href={ sketchHref }
      >
        {name}
      </Link>

      <span>
        {activeSlideIndex !== undefined && ` · slide ${ activeSlideIndex + 1 }`}
      </span>
    </p>
  );
}
