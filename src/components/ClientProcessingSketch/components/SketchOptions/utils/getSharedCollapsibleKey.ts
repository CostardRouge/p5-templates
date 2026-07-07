export function getSharedCollapsibleKey( path: string ): string {
  const sketchIndex = path.indexOf( ".sketch" );

  if ( sketchIndex !== -1 ) {
    return path.slice( sketchIndex + 1 );
  }

  if ( path.startsWith( "sketch." ) ) {
    return path;
  }

  return path;
}