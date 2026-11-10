/**
 * What an export variant can be posted as — said BEFORE it renders, so the
 * table's *Posts as* column and the Post band can grey out what cannot work,
 * with the reason, instead of failing after minutes of capture.
 *
 * Pure: a variant and the number of slides it covers in, a shape out. The
 * same rules are checked again on the real files when they exist
 * (`client.ts`'s `postProblem` / `channelProblem`).
 */

import {
  MAX_CAROUSEL_ITEMS, type PostKind, type Provider
} from "./client";
import type {
  ExportVariant
} from "../export/variants";

export interface PostShape {
  /** How many files the variant hands over, or null when it cannot be posted. */
  files: number | null;
  /** What the files are. */
  media: "video" | "image";
  /** The Instagram kinds these files can be, the first the one proposed. */
  kinds: PostKind[];
  /** Why the variant cannot be posted at all, or null. */
  reason: string | null;
}

/** The files a variant produces, as the runner makes them (`runExportBatch`). */
export function postShape(
  variant: Pick<ExportVariant, "kind" | "format" | "delivery" | "frameCount">,
  slideSpan: number
): PostShape {
  const span = Math.max(
    1,
    slideSpan
  );

  if ( variant.kind === "video" ) {
    if ( variant.format !== "mp4" ) {
      return {
        files: null,
        media: "video",
        kinds: [],
        reason: `Instagram, TikTok and YouTube take mp4, not ${ variant.format }.`
      };
    }

    const files = span > 1 && variant.delivery === "separate" ? span : 1;

    return shapeOf(
      files,
      "video"
    );
  }

  if ( variant.kind === "image" ) {
    return shapeOf(
      span,
      "image"
    );
  }

  if ( variant.frameCount === "all" ) {
    return {
      files: null,
      media: "image",
      kinds: [],
      reason: `Every frame is more than a carousel holds (${ MAX_CAROUSEL_ITEMS } at most).`
    };
  }

  return shapeOf(
    variant.frameCount * span,
    "image"
  );
}

function shapeOf(
  files: number, media: "video" | "image"
): PostShape {
  if ( files > MAX_CAROUSEL_ITEMS ) {
    return {
      files: null,
      media,
      kinds: [],
      reason: `${ files } files is more than a carousel holds (${ MAX_CAROUSEL_ITEMS } at most).`
    };
  }

  if ( files > 1 ) {
    return {
      files,
      media,
      kinds: [
        "carousel"
      ],
      reason: null
    };
  }

  return {
    files: 1,
    media,
    kinds: media === "video" ? [
      "reel",
      "post",
      "story"
    ] : [
      "post",
      "story"
    ],
    reason: null
  };
}

/** Why an account on `provider` cannot take this shape, or null — `channelProblem` before the files exist. */
export function providerFits(
  provider: Provider, shape: PostShape
): string | null {
  if ( shape.files === null ) {
    return shape.reason;
  }

  if ( provider === "youtube" && ( shape.media !== "video" || shape.files !== 1 ) ) {
    return "YouTube takes one video.";
  }

  if ( provider === "tiktok" && shape.media === "video" && shape.files !== 1 ) {
    return "TikTok takes one video, or pictures.";
  }

  if ( provider === "other" ) {
    return "Sketchbook posts to Instagram, TikTok and YouTube.";
  }

  return null;
}

/** The kind kept when the variant changes: the one asked if it still fits, else the shape's first. */
export function fitKind(
  asked: PostKind | null, shape: PostShape
): PostKind | null {
  if ( asked && shape.kinds.includes( asked ) ) {
    return asked;
  }

  return shape.kinds[ 0 ] ?? null;
}

export const KIND_LABEL: Record<PostKind, string> = {
  reel: "Reel",
  post: "Post",
  carousel: "Carousel",
  story: "Story"
};

/** Why a kind is not offered for this shape, for the greyed control's tooltip. */
export function kindWhy(
  kind: PostKind, shape: PostShape
): string | null {
  if ( shape.kinds.includes( kind ) ) {
    return null;
  }

  if ( kind === "reel" ) {
    return "A Reel is one video.";
  }

  if ( kind === "carousel" ) {
    return "A carousel is several files: a variant covering several slides, or frames.";
  }

  return `A ${ kind } is one picture or one video.`;
}
