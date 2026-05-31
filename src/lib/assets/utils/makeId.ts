/**
 * Cheap stable id for asset instances. Not security-sensitive — just needs
 * to be unique within a sketch session so DnD and React keys behave.
 */
export function makeAssetId(): string {
  return `a_${ Date.now().toString( 36 ) }_${ Math.random().toString( 36 )
    .slice(
      2,
      8
    ) }`;
}
