import getCaptureOptions from "@/utils/getCaptureOptions";
import {
  getJobById
} from "@/lib/jobStore";
import {
  renderStudio,
  type RouteParams,
  type StudioSearchParams
} from "./studio";

/* The studio on the full server (next.config.ts, "Two builds"): rendered per
   request, because the query string matters here — a recording job opened by
   ?id= (from PostgreSQL and S3), the headless preview generator's ?capturing
   with its framerate and duration overrides. */

export {
  generateMetadata
} from "./studio";

export const revalidate = 0;

export default async function StudioPage( {
  params,
  searchParams
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<StudioSearchParams>;
} ) {
  return renderStudio( {
    params,
    searchParams: await searchParams,
    backendRecording: process.env.BACKEND_RECORDING === "true",
    loadJob: async( id ) => {
      const job = await getJobById( id );

      if ( !job ) {
        return null;
      }

      return {
        job,
        options: await getCaptureOptions( `${ job.id }/options.json` )
      };
    }
  } );
}
