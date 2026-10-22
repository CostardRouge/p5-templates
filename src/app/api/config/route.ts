export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json( {
    backendRecording: process.env.BACKEND_RECORDING === "true"
  } );
}
