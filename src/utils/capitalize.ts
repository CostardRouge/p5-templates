export default function capitalize( word: string ): string {
  return word.charAt( 0 ).toUpperCase() + word.slice( 1 );
}