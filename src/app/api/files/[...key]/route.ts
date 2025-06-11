import {
  NextResponse
} from "next/server";
import {
  getDownloadUrlFromS3Url
} from "@/lib/s3";

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: Promise<{
      key: string[]
    }>
}
) {
  const objectKey = ( await params ).key.join( "/" );
  const signedUrl = await getDownloadUrlFromS3Url( objectKey );

  return NextResponse.redirect(
    signedUrl,
    307
  );
}