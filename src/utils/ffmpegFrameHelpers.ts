import fs from "node:fs/promises";
import path from "node:path";

export function naturalStringCompare(
  a: string, b: string
): number {
  // Natural order compare so "..._2.png" < "..._10.png"
  const aParts = a
    .split( /(\d+)/ )
    .map( ( part ) => ( /\d+/.test( part ) ? Number( part ) : part ) );
  const bParts = b
    .split( /(\d+)/ )
    .map( ( part ) => ( /\d+/.test( part ) ? Number( part ) : part ) );

  const length = Math.max(
    aParts.length,
    bParts.length
  );

  for ( let index = 0; index < length; index++ ) {
    const aPart = aParts[ index ];
    const bPart = bParts[ index ];

    if ( aPart === undefined ) {
      return -1;
    }
    if ( bPart === undefined ) {
      return 1;
    }
    if ( aPart === bPart ) {
      continue;
    }
    if ( typeof aPart === "number" && typeof bPart === "number" ) {
      return aPart - bPart;
    }
    return String( aPart ).localeCompare( String( bPart ) );
  }

  return 0;
}

export async function listPngFramesSorted( framesDirectoryPath: string ): Promise<string[]> {
  const entries = await fs.readdir(
    framesDirectoryPath,
    {
      withFileTypes: true
    }
  );

  return entries
    .filter( ( entry ) => entry.isFile() && entry.name.toLowerCase().endsWith( ".png" ) )
    .map( ( entry ) => entry.name )
    .sort( naturalStringCompare );
}

// Concat demuxer wants: file 'absolute/path.png' — single-quote and escape internal quotes.
export function escapePathForFfmpegConcat( filePath: string ): string {
  return `'${ filePath.replace(
    /'/g,
    "'\\''"
  ) }'`;
}

export async function writeConcatList(
  framesDirectoryPath: string,
  sortedFrameFileNames: string[],
  secondsPerFrame: number,
  listFileName: string
): Promise<string> {
  const lines: string[] = [];

  for ( const fileName of sortedFrameFileNames ) {
    const absolutePath = path.resolve(
      framesDirectoryPath,
      fileName
    );

    lines.push( `file ${ escapePathForFfmpegConcat( absolutePath ) }` );
    lines.push( `duration ${ secondsPerFrame }` );
  }

  // Repeat last entry so ffmpeg honours its duration
  const lastAbsolutePath = path.resolve(
    framesDirectoryPath,
    sortedFrameFileNames[ sortedFrameFileNames.length - 1 ]
  );

  lines.push( `file ${ escapePathForFfmpegConcat( lastAbsolutePath ) }` );

  const listFilePath = path.resolve(
    framesDirectoryPath,
    listFileName
  );

  await fs.writeFile(
    listFilePath,
    lines.join( "\n" ),
    "utf8"
  );
  return listFilePath;
}
