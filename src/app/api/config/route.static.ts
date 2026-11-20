/* The static front's answer to the MenuBar's question (route.server.ts reads
   BACKEND_RECORDING at request time on the full server): a static front has
   no backend, so it is a plain file that always says false. */
export const dynamic = "force-static";

export function GET() {
  return Response.json( {
    backendRecording: false
  } );
}
