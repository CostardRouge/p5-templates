/**
 * Pause execution for the given number of milliseconds.
 *
 * @example
 * await sleep(500);               // wait half a second
 * console.log("done");
 */
export default function sleep( ms: number ): Promise<void> {
  return new Promise( resolve => setTimeout(
    resolve,
    ms
  ) );
}