import {
  getBufferFromS3Url,
} from "@/lib/s3";

async function getCaptureOptions( optionsKey: string ): Promise<Record<string, any>> {
  const buffer = await getBufferFromS3Url( optionsKey );

  return JSON.parse( buffer.toString( "utf-8" ) );
}

export default getCaptureOptions;