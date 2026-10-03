import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client
} from "@aws-sdk/client-s3";

import {
  deleteJobArtifacts
} from "@/lib/connections/s3";

const JOB_ID = "3f1c2a9e-7b4d-4c1a-9e2f-0a1b2c3d4e5f";

type Page = {
  keys: string[];
  next?: string;
};

/** Stub `S3Client.send`: answer listings page by page, record deletes. */
function stubS3( pages: Page[] ) {
  const listed: ListObjectsV2Command[ "input" ][] = [];
  const deleted: string[][] = [];
  let page = 0;

  const send = jest.spyOn(
    S3Client.prototype,
    "send"
  ).mockImplementation( async( command: unknown ) => {
    if ( command instanceof ListObjectsV2Command ) {
      listed.push( command.input );

      const current = pages[ page++ ] ?? {
        keys: []
      };

      return {
        Contents: current.keys.map( ( Key ) => ( {
          Key
        } ) ),
        IsTruncated: Boolean( current.next ),
        NextContinuationToken: current.next
      };
    }

    if ( command instanceof DeleteObjectsCommand ) {
      deleted.push( ( command.input.Delete?.Objects ?? [] ).map( ( object ) => object.Key! ) );
      return {};
    }

    throw new Error( "unexpected command" );
  } );

  return {
    send,
    listed,
    deleted
  };
}

describe(
  "deleteJobArtifacts",
  () => {
    afterEach( () => {
      jest.restoreAllMocks();
    } );

    it(
      "lists the job's folder with a trailing slash, never the bare id",
      async() => {
        const s3 = stubS3( [
          {
            keys: [
              `${ JOB_ID }/options.json`
            ]
          }
        ] );

        await deleteJobArtifacts( JOB_ID );

        expect( s3.listed ).toHaveLength( 1 );
        expect( s3.listed[ 0 ].Prefix ).toBe( `${ JOB_ID }/` );
        expect( s3.deleted ).toEqual( [
          [
            `${ JOB_ID }/options.json`
          ]
        ] );
      }
    );

    it(
      "follows continuation tokens so a large job is deleted in full",
      async() => {
        const s3 = stubS3( [
          {
            keys: [
              `${ JOB_ID }/a.mp4`
            ],
            next: "page-2"
          },
          {
            keys: [
              `${ JOB_ID }/b.mp4`
            ]
          }
        ] );

        await deleteJobArtifacts( JOB_ID );

        expect( s3.listed.map( ( input ) => input.ContinuationToken ) ).toEqual( [
          undefined,
          "page-2"
        ] );
        expect( s3.deleted.flat().sort() ).toEqual( [
          `${ JOB_ID }/a.mp4`,
          `${ JOB_ID }/b.mp4`
        ] );
      }
    );

    it(
      "batches deletes by 1000 keys",
      async() => {
        const keys = Array.from(
          {
            length: 1001
          },
          (
            _, index
          ) => `${ JOB_ID }/frame-${ index }.png`
        );
        const s3 = stubS3( [
          {
            keys
          }
        ] );

        await deleteJobArtifacts( JOB_ID );

        expect( s3.deleted.map( ( batch ) => batch.length ) ).toEqual( [
          1000,
          1
        ] );
      }
    );

    it(
      "also deletes extra keys outside the folder, once",
      async() => {
        const s3 = stubS3( [
          {
            keys: [
              `${ JOB_ID }/video.mp4`
            ]
          }
        ] );

        await deleteJobArtifacts(
          JOB_ID,
          [
            `${ JOB_ID }.zip`,
            `${ JOB_ID }/video.mp4`
          ]
        );

        expect( s3.deleted.flat().sort() ).toEqual( [
          `${ JOB_ID }.zip`,
          `${ JOB_ID }/video.mp4`
        ] );
      }
    );

    it(
      "sends no delete when the job owns nothing",
      async() => {
        const s3 = stubS3( [
          {
            keys: []
          }
        ] );

        await deleteJobArtifacts( JOB_ID );

        expect( s3.deleted ).toEqual( [] );
      }
    );

    it.each( [
      [
        ""
      ],
      [
        ".."
      ],
      [
        "a/b"
      ]
    ] )(
      "refuses the id %j without touching the bucket",
      async( jobId ) => {
        const s3 = stubS3( [] );

        await expect( deleteJobArtifacts( jobId ) ).rejects.toThrow( "unsafe job id" );
        expect( s3.send ).not.toHaveBeenCalled();
      }
    );
  }
);
