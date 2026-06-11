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
 *   - engine    → /templates/<engineId>
 *   - category  → /templates/<engineId>?category=<category>
 *   - name      → /templates/<engineId>/<category?>/<name>
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
    ? `/templates/${ engineId }/${ category }/${ name }`
    : `/templates/${ engineId }/${ name }`;

  return (
    <p className="truncate">
      <Link
        href={ `/templates/${ engineId }` }
        target="_blank"
      >
        {engineLabel}
      </Link>

      {category && (
        <>
          <span className="text-xs">{" · "}</span>
          <Link
            href={ `/templates/${ engineId }?category=${ encodeURIComponent( category ) }` }
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
