import type {
  Metadata
} from "next";
import {
  notFound
} from "next/navigation";
import React from "react";

import {
  isKnownEngine
} from "@/engines/engineCatalog";
import {
  findSketchMeta
} from "@/engines/metadata";
import {
  OptionsSchema
} from "@/types/sketch.types";
import {
  getJSONSketchOptions,
  getSketchMeta
} from "@/utils/getSketchOptions";
import EmbedSketchClient from "@/components/EmbedSketch/EmbedSketchClient";

/* ------------------------------------------------------------------ */
/*  Route params                                                       */
/* ------------------------------------------------------------------ */
type RouteParams = {
  engine: string;
  sketch: string[]; // catch-all: ["category", "name"] or ["name"]
};

export const revalidate = 0;

/* ------------------------------------------------------------------ */
/*  Metadata — embeds are framed inside other pages, never indexed as  */
/*  standalone documents.                                              */
/* ------------------------------------------------------------------ */
export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: {
      index: false,
      follow: false
    }
  };
}

/* ------------------------------------------------------------------ */
/*  Page — a chrome-free, stateless sketch host.                       */
/*                                                                     */
/*  Mirrors the studio page's base-option construction (schema         */
/*  defaults + persisted options.json + form defaults on `.sketch`)    */
/*  so a sketch boots identically, then hands off to the client, which */
/*  layers the URL-fragment delta on top. No job, no snapshot, no DB.  */
/* ------------------------------------------------------------------ */
export default async function EmbedPage( {
  params
}: {
  params: Promise<RouteParams>;
} ) {
  const {
    engine: engineId, sketch: sketchSegments
  } = await params;

  if ( !isKnownEngine( engineId ) ) {
    return notFound();
  }

  const sketchName = sketchSegments[ sketchSegments.length - 1 ];
  const sketchMeta = findSketchMeta(
    sketchName,
    engineId
  );

  if ( !sketchMeta ) {
    return notFound();
  }

  const sketchOptions = OptionsSchema.parse( {} );

  const {
    formValues
  } = await getSketchMeta(
    sketchName,
    engineId
  );

  const jsonOptions = await getJSONSketchOptions(
    sketchName,
    engineId
  );

  if ( jsonOptions ) {
    Object.assign(
      sketchOptions,
      jsonOptions
    );
  }

  if ( formValues ) {
    Object.assign(
      sketchOptions,
      {
        sketch: structuredClone( formValues )
      }
    );
  }

  sketchOptions.name = sketchName;

  return (
    <EmbedSketchClient
      engineId={ engineId }
      name={ sketchName }
      baseOptions={ sketchOptions }
      width={ sketchOptions.size.width }
      height={ sketchOptions.size.height }
    />
  );
}
