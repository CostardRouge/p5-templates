async function fetchDownload( url: string, options?: {
 method?: string, body?: FormData
} ) {
  const {
    method = "POST", body
  } = options || {
  };
  const response = await fetch(
    url,
    {
      method,
      body,
    }
  );

  if ( !response.ok ) {
    throw new Error( "recording failed" );
  }

  const blob = await response.blob();
  const objectURL = URL.createObjectURL( blob );

  const contentDisposition = response.headers.get( "Content-Disposition" );
  let filename = "download.png";

  if ( contentDisposition ) {
    const match = contentDisposition.match( /filename="?(.+?)"?$/ );

    if ( match ) {
      filename = match[ 1 ];
    }
  }

  const a = document.createElement( "a" );

  a.href = objectURL;
  a.download = filename;
  document.body.appendChild( a );
  a.click();
  a.remove();
  URL.revokeObjectURL( objectURL );
}

export default fetchDownload;