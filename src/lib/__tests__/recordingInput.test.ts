import {
  isSafeJobId,
  isSafeObjectPath,
  isSubmittableStatus
} from "@/lib/recordingInput";

describe(
  "isSafeJobId",
  () => {
    it.each( [
      [
        "3f1c2a9e-7b4d-4c1a-9e2f-0a1b2c3d4e5f"
      ],
      [
        "job_42"
      ],
      [
        "A1"
      ]
    ] )(
      "accepts %j",
      ( id ) => {
        expect( isSafeJobId( id ) ).toBe( true );
      }
    );

    it.each( [
      [
        ""
      ],
      [
        "."
      ],
      [
        ".."
      ],
      [
        "../etc"
      ],
      [
        "a/b"
      ],
      [
        "a\\b"
      ],
      [
        "-leading-dash"
      ],
      [
        "has space"
      ],
      [
        "a.b"
      ],
      [
        "x".repeat( 129 )
      ],
      [
        undefined
      ],
      [
        42
      ]
    ] )(
      "refuses %j",
      ( id ) => {
        expect( isSafeJobId( id ) ).toBe( false );
      }
    );
  }
);

describe(
  "isSafeObjectPath",
  () => {
    it.each( [
      [
        "photo.jpg"
      ],
      [
        "global/images/photo.jpg"
      ],
      [
        "slide-0/images/IMG 1821.jpeg"
      ],
      [
        "..hidden.png"
      ]
    ] )(
      "accepts the names the studio sends: %j",
      ( name ) => {
        expect( isSafeObjectPath( name ) ).toBe( true );
      }
    );

    it.each( [
      [
        ""
      ],
      [
        "../options.json"
      ],
      [
        "global/../../other-job/options.json"
      ],
      [
        "/absolute.jpg"
      ],
      [
        "trailing/"
      ],
      [
        "double//slash.jpg"
      ],
      [
        "./here.jpg"
      ],
      [
        "back\\slash.jpg"
      ],
      [
        "new\nline.jpg"
      ],
      [
        "x".repeat( 513 )
      ]
    ] )(
      "refuses %j",
      ( name ) => {
        expect( isSafeObjectPath( name ) ).toBe( false );
      }
    );
  }
);

describe(
  "isSubmittableStatus",
  () => {
    it(
      "accepts the two statuses a client can mean",
      () => {
        expect( isSubmittableStatus( "draft" ) ).toBe( true );
        expect( isSubmittableStatus( "queued" ) ).toBe( true );
      }
    );

    it.each( [
      [
        "completed"
      ],
      [
        "active"
      ],
      [
        "failed"
      ],
      [
        "cancelled"
      ],
      [
        "bogus"
      ],
      [
        null
      ]
    ] )(
      "refuses %j",
      ( status ) => {
        expect( isSubmittableStatus( status ) ).toBe( false );
      }
    );
  }
);
