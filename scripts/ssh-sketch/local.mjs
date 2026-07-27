#!/usr/bin/env node
// Run the komputery sketch directly in the current terminal — the quickest way
// to see the SSH PoC's renderer without an SSH server in between.
//
//   node scripts/ssh-sketch/local.mjs                 # defaults (komputery)
//   node scripts/ssh-sketch/local.mjs --palette crt   # crt | hot | komputery
//   node scripts/ssh-sketch/local.mjs --mode spectrum # pulse | spectrum
//   node scripts/ssh-sketch/local.mjs --fps 24 --bell
//   node scripts/ssh-sketch/local.mjs --once          # print a single frame
//
// q / Ctrl+C quits.

import {
  ENTER_SCREEN,
  LEAVE_SCREEN,
  createRenderer,
  startLoop
} from "./renderer.mjs";

function parseArgs( argv ) {
  const parsed = {
    overrides: {},
    fps: 30,
    bell: false,
    once: false
  };

  for ( let i = 0; i < argv.length; i++ ) {
    const arg = argv[ i ];

    if ( arg === "--palette" ) {
      parsed.overrides.palette = argv[ ++i ];
    } else if ( arg === "--mode" ) {
      parsed.overrides.colorMode = argv[ ++i ];
    } else if ( arg === "--fps" ) {
      parsed.fps = Number( argv[ ++i ] ) || 30;
    } else if ( arg === "--bell" ) {
      parsed.bell = true;
    } else if ( arg === "--once" ) {
      parsed.once = true;
    }
  }

  return parsed;
}

const args = parseArgs( process.argv.slice( 2 ) );

const getSize = () => ( {
  cols: process.stdout.columns || 80,
  rows: process.stdout.rows || 24
} );

// --once: a single frame straight to stdout (no alt screen, no loop). Handy
// for piping, screenshots, and smoke tests on non-TTY stdout.
if ( args.once ) {
  const renderer = createRenderer( args.overrides );
  const {
    cols, rows
  } = getSize();

  process.stdout.write( renderer.frame(
    cols,
    rows,
    0.4
  ) );
  process.stdout.write( "\x1b[0m\n" );
  process.exit( 0 );
}

process.stdout.write( ENTER_SCREEN );

const stop = startLoop( {
  write: ( chunk ) => process.stdout.write( chunk ),
  getSize,
  overrides: args.overrides,
  fps: args.fps,
  bell: args.bell
} );

function quit( ) {
  stop( );
  process.stdout.write( LEAVE_SCREEN );
  process.exit( 0 );
}

process.on(
  "SIGINT",
  quit
);
process.on(
  "SIGTERM",
  quit
);

if ( process.stdin.isTTY ) {
  process.stdin.setRawMode( true );
  process.stdin.resume( );
  process.stdin.on(
    "data",
    ( data ) => {
      const key = data.toString( );

      if ( key === "q" || key === "\x03" ) {
        quit( );
      }
    }
  );
}
