import {
  getBufferFromS3Url,
} from "@/lib/connections/s3";
import {
  RecordingSketchOptions
} from "@/types/recording.types";

async function getCaptureOptions( optionsKey: string ): Promise<RecordingSketchOptions> {
  const buffer = await getBufferFromS3Url( optionsKey );

  return JSON.parse( buffer.toString( "utf-8" ) );
}

export default getCaptureOptions;