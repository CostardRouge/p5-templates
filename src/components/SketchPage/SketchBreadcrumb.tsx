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
        target="_blank"
      >
        {engineLabel}
      </Link>

      {category && (
        <>
          <span className="text-xs">{" · "}</span>
          <Link
            href={ `/sketches/${ engineId }?category=${ encodeURIComponent( category ) }` }
            target="_blank"
          >
            {category}
          </Link>
        </>
      )}

      <span className="text-xs">{" · "}</span>
      <Link
        href={ sketchHref }
        target="_blank"
      >
        {name}
      </Link>

      <span>
        {activeSlideIndex !== undefined && ` · slide ${ activeSlideIndex + 1 }`}
      </span>
    </p>
  );
}
