import os from "node:os";

/**
 * Why a recording failed, as it is stored on the job (`Job.error`) and shown to
 * whoever reads the job — the recordings page, the agent's `jobs.get`.
 *
 * Before this the reason lived only in the server log: the row said `failed`,
 * the progression said which step was running, and the step names mislead (an
 * FFmpeg failure reads "failed during uploading"). The caught error is the one
 * thing that says what happened, so it is kept — but a job row is readable by
 * anyone (`GET /api/recordings/<id>`, no auth; see docs/memory/security.md),
 * so what is kept is the message, never the stack, with what must not leave
 * the server taken out:
 *
 * - credentials in a URL (`redis://:secret@host`, `postgresql://user:pw@…`),
 *   which a connection error quotes verbatim;
 * - presigned-URL signatures and credentials (`X-Amz-Signature=…`);
 * - the server's temp directory, reduced to `<tmp>`;
 * - terminal colour codes; and the whole is capped.
 */

export const JOB_ERROR_MAX_CHARS = 2000;

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi;
const AMZ_SECRETS = /\b(X-Amz-(?:Signature|Credential|Security-Token))=[^&\s"']+/gi;

function escapeRegExp( value: string ): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

export function jobFailureReason(
  error: unknown,
  tmpDir: string = os.tmpdir()
): string {
  const raw = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : error === undefined || error === null
        ? ""
        : String( error );
  let text = raw
    .replace(
      ANSI,
      ""
    )
    .replace(
      URL_CREDENTIALS,
      "$1***@"
    )
    .replace(
      AMZ_SECRETS,
      "$1=***"
    );

  if ( tmpDir ) {
    text = text.replace(
      new RegExp(
        escapeRegExp( tmpDir.replace(
          /\/+$/,
          ""
        ) ),
        "g"
      ),
      "<tmp>"
    );
  }

  text = text.trim();

  if ( !text ) {
    return "Unknown error";
  }

  return text.length > JOB_ERROR_MAX_CHARS
    ? `${ text.slice(
      0,
      JOB_ERROR_MAX_CHARS - 1
    ) }…`
    : text;
}
