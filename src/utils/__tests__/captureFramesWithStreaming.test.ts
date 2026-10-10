import type {
  Page
} from "playwright";

import {
  spawn
} from "child_process";

import {
  captureFramesWithStreaming
} from "../captureFramesWithStreaming";
import {
  muxSketchAudio
} from "@/utils/muxSketchAudio";

/**
 * FFmpeg is replaced by real child processes that misbehave on purpose, so
 * what is exercised is the actual pipe: a binary that does not exist, an
 * encoder that dies while the frame loop is blocked on a full pipe, and the
 * normal exit paths.
 */

jest.mock(
  "child_process",
  () => ( {
    ...jest.requireActual( "child_process" ),
    spawn: jest.fn()
  } )
);

jest.mock(
  "@/utils/captureSurface",
  () => ( {
    detectCaptureSurface: jest.fn().mockResolvedValue( {
      kind: "canvas"
    } ),
    prepareCapture: jest.fn().mockResolvedValue( undefined ),
    renderCaptureFrame: jest.fn().mockResolvedValue( undefined ),
    // Big frames, so a process that never reads stdin fills the pipe fast.
    readCaptureFrame: jest.fn().mockResolvedValue( Buffer.alloc( 256 * 1024 ) )
  } )
);

jest.mock(
  "@/utils/muxSketchAudio",
  () => ( {
    muxSketchAudio: jest.fn().mockResolvedValue( undefined )
  } )
);

const realSpawn: typeof spawn = jest.requireActual( "child_process" ).spawn;
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

// No `waitForTimeout`: the loop must not sleep between frames (a fixed 10 ms
// used to be added to every frame), so a sleep coming back throws here.
const page = {} as unknown as Page;

function fakeFfmpeg( script: string ) {
  mockedSpawn.mockImplementation( () => realSpawn(
    process.execPath,
    [
      "-e",
      script
    ]
  ) );
}

function capture( totalFrames: number ) {
  return captureFramesWithStreaming( {
    page,
    totalFrames,
    outputVideoPath: "/dev/null",
    framerate: 30
  } );
}

describe(
  "captureFramesWithStreaming",
  () => {
    beforeEach( () => {
      jest.clearAllMocks();
    } );

    it(
      "rejects, instead of throwing out of band, when FFmpeg cannot start",
      async() => {
        mockedSpawn.mockImplementation( () => realSpawn(
          "sketchbook-no-such-ffmpeg",
          []
        ) );

        await expect( capture( 3 ) ).rejects.toThrow( "ENOENT" );
      }
    );

    it(
      "rejects when FFmpeg dies while the loop waits for the pipe to drain",
      async() => {
        // Never reads stdin, then exits: the writes block on a full pipe.
        fakeFfmpeg( "setTimeout( () => process.exit( 3 ), 200 );" );

        await expect( capture( 200 ) ).rejects.toThrow( /FFmpeg exited/ );
      },
      15_000
    );

    it(
      "resolves and muxes audio when FFmpeg consumes every frame and exits 0",
      async() => {
        fakeFfmpeg( "process.stdin.resume(); process.stdin.on( \"end\", () => process.exit( 0 ) );" );

        await expect( capture( 5 ) ).resolves.toBeUndefined();
        expect( muxSketchAudio ).toHaveBeenCalledTimes( 1 );
      }
    );

    it(
      "rejects with FFmpeg's stderr when it exits non-zero at the end",
      async() => {
        fakeFfmpeg( "process.stdin.resume(); process.stdin.on( \"end\", () => { process.stderr.write( \"encoder said no\" ); process.exit( 1 ); } );" );

        await expect( capture( 2 ) ).rejects.toThrow( /code 1[\s\S]*encoder said no/ );
        expect( muxSketchAudio ).not.toHaveBeenCalled();
      }
    );
  }
);
