import {
  JOB_ERROR_MAX_CHARS, jobFailureReason
} from "../jobFailure";

describe(
  "jobFailureReason",
  () => {
    it(
      "keeps the message of what was caught, not its stack",
      () => {
        const error = new Error( "FFmpeg exited with code 187\n[libx264] height not divisible by 2 (540x675)" );

        expect( jobFailureReason(
          error,
          "/tmp"
        ) ).toBe( "FFmpeg exited with code 187\n[libx264] height not divisible by 2 (540x675)" );
        expect( jobFailureReason(
          "page.goto: Timeout 30000ms exceeded.",
          "/tmp"
        ) ).toBe( "page.goto: Timeout 30000ms exceeded." );
      }
    );

    it(
      "takes out what must not leave the server: URL credentials, presigned secrets, the temp dir",
      () => {
        expect( jobFailureReason(
          new Error( "connect ECONNREFUSED redis://:s3cret@redis:6379 and postgresql://user:pw@db:5432/x" ),
          "/tmp"
        ) ).toBe( "connect ECONNREFUSED redis://***@redis:6379 and postgresql://***@db:5432/x" );
        expect( jobFailureReason(
          new Error( "GET https://minio:9000/r/a.mp4?X-Amz-Credential=AKIA%2F2026&X-Amz-Signature=abc123 failed" ),
          "/tmp"
        ) ).toBe( "GET https://minio:9000/r/a.mp4?X-Amz-Credential=***&X-Amz-Signature=*** failed" );
        expect( jobFailureReason(
          new Error( "ENOENT: no such file '/var/tmp/run/job-1/frame.png'" ),
          "/var/tmp/run/"
        ) ).toBe( "ENOENT: no such file '<tmp>/job-1/frame.png'" );
      }
    );

    it(
      "strips colour codes, caps the length and never stores an empty reason",
      () => {
        expect( jobFailureReason(
          "\u001b[31mboom\u001b[0m",
          "/tmp"
        ) ).toBe( "boom" );
        expect( jobFailureReason(
          "x".repeat( 5000 ),
          "/tmp"
        ) ).toHaveLength( JOB_ERROR_MAX_CHARS );
        expect( jobFailureReason(
          undefined,
          "/tmp"
        ) ).toBe( "Unknown error" );
        expect( jobFailureReason(
          new Error( "  " ),
          "/tmp"
        ) ).toBe( "Unknown error" );
      }
    );
  }
);
