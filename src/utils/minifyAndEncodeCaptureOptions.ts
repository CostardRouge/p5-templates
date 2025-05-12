function minifyAndEncodeCaptureOptions( captureOptions: Record<string, any> ) {
  const jsonString = JSON.stringify( captureOptions );

  return Buffer.from( jsonString ).toString( "base64" );
}

export default minifyAndEncodeCaptureOptions;