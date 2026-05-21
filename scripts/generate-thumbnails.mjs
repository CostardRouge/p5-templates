#!/usr/bin/env node
import fs from "fs";
import path from "path";
import {
  fileURLToPath
} from "url";
import sharp from "sharp";

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const TEMPLATES_DIR = path.join(
  __dirname,
  "../public/assets/images/templates"
);

const SIZES = [
  {
    suffix: "",
    width: 360,
    height: 450
  },
  {
    suffix: "-2x",
    width: 720,
    height: 900
  }
];

const WEBP_QUALITY = 80;
const CONCURRENCY = 8;

async function isUpToDate( target, source ) {
  try {
    const [
      t,
      s
    ] = await Promise.all( [
      fs.promises.stat( target ),
      fs.promises.stat( source )
    ] );
    return t.mtimeMs >= s.mtimeMs;
  } catch {
    return false;
  }
}

async function processJpeg( jpegPath, stats ) {
  const dir = path.dirname( jpegPath );

  for ( const {
    suffix, width, height
  } of SIZES ) {
    const webpPath = path.join(
      dir,
      `thumbnail${ suffix }.webp`
    );

    if ( await isUpToDate(
      webpPath,
      jpegPath
    ) ) {
      stats.skipped += 1;
      continue;
    }

    await sharp( jpegPath )
      .rotate()
      .resize(
        width,
        height,
        {
          fit: "cover"
        }
      )
      .webp( {
        quality: WEBP_QUALITY
      } )
      .toFile( webpPath );

    stats.written += 1;
    console.log( `✓ ${ path.relative(
      process.cwd(),
      webpPath
    ) }` );
  }
}

async function collectJpegs() {
  const result = [];

  if ( !fs.existsSync( TEMPLATES_DIR ) ) {
    return result;
  }

  const engines = await fs.promises.readdir(
    TEMPLATES_DIR,
    {
      withFileTypes: true
    }
  );

  for ( const engine of engines ) {
    if ( !engine.isDirectory() ) continue;

    const engineDir = path.join(
      TEMPLATES_DIR,
      engine.name
    );

    const sketches = await fs.promises.readdir(
      engineDir,
      {
        withFileTypes: true
      }
    );

    for ( const sketch of sketches ) {
      if ( !sketch.isDirectory() ) continue;

      const jpeg = path.join(
        engineDir,
        sketch.name,
        "thumbnail.jpeg"
      );

      try {
        await fs.promises.access( jpeg );
        result.push( jpeg );
      } catch {
        // No thumbnail in this sketch dir — skip silently
      }
    }
  }

  return result;
}

async function run() {
  const jpegs = await collectJpegs();
  const stats = {
    written: 0,
    skipped: 0
  };

  // Simple concurrency limiter: process in chunks of CONCURRENCY
  for ( let i = 0; i < jpegs.length; i += CONCURRENCY ) {
    const chunk = jpegs.slice(
      i,
      i + CONCURRENCY
    );
    await Promise.all( chunk.map( ( j ) => processJpeg(
      j,
      stats
    ) ) );
  }

  console.log(
    `\nThumbnails: ${ stats.written } written, ${ stats.skipped } up-to-date (${ jpegs.length } sources).`
  );
}

run().catch( ( err ) => {
  console.error( err );
  process.exit( 1 );
} );
