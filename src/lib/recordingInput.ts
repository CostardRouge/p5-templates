import type {
  JobStatusEnum
} from "@/types/recording.types";

/**
 * Checks for the values a client sends to the recording API that end up as
 * S3 keys or directory names. There is no authentication in front of these
 * routes (see docs/memory/security.md), so each value is checked here, once,
 * before it reaches storage.
 */

/**
 * A job id the server can safely use as an S3 folder (`<id>/…`) and a temp
 * directory name: letters, digits, `-` and `_`, starting with a letter or a
 * digit. Every id the server mints is a v4 UUID, which passes; the charset is
 * kept wider than UUIDs so a pre-UUID job, if any survives, stays usable.
 * What it refuses is what turns an id into a path: `""`, `.`, `..`, `/`, `\`.
 */
const SAFE_JOB_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function isSafeJobId( value: unknown ): value is string {
  return typeof value === "string" && SAFE_JOB_ID.test( value );
}

/**
 * An uploaded asset's name becomes the tail of its S3 key
 * (`<jobId>/assets/<name>`). The client sends scoped names with slashes on
 * purpose (`global/images/a.jpg`, `slide-0/images/a.jpg`), so a slash is
 * allowed — an empty, `.` or `..` segment, a backslash or a control character
 * is not.
 */
export function isSafeObjectPath( value: string ): boolean {
  if ( value.length === 0 || value.length > 512 ) {
    return false;
  }

  if ( /[\\\u0000-\u001f\u007f]/.test( value ) ) {
    return false;
  }

  return value.split( "/" ).every( ( segment ) => segment !== "" && segment !== "." && segment !== ".." );
}

/**
 * The only statuses a submission can mean: save a draft, or queue it. The
 * other statuses are the worker's to set — a client that sends `completed`
 * would create a finished job with no recording behind it.
 */
export const SUBMITTABLE_STATUSES = [
  "draft",
  "queued"
] as const satisfies readonly JobStatusEnum[];

export type SubmittableStatus = ( typeof SUBMITTABLE_STATUSES )[ number ];

export function isSubmittableStatus( value: unknown ): value is SubmittableStatus {
  return typeof value === "string" && ( SUBMITTABLE_STATUSES as readonly string[] ).includes( value );
}
