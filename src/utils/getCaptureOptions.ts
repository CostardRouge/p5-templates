import {
  getBufferFromS3Url,
} from "@/lib/connections/s3";
import {
  SketchOption
} from "@/types/sketch.types";

async function getCaptureOptions( optionsKey: string ): Promise<SketchOption> {
  const buffer = await getBufferFromS3Url( optionsKey );

  return JSON.parse( buffer.toString( "utf-8" ) );
}

export default getCaptureOptions;