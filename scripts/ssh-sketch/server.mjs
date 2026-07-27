#!/usr/bin/env node
// ssh-sketch PoC server — `ssh <host> -p 2222` opens the komputery sketch
// rendered live in your terminal, terminal.shop-style.
//
//   node scripts/ssh-sketch/server.mjs        # listens on :2222
//   SSH_SKETCH_PORT=2345 node scripts/ssh-sketch/server.mjs
//
// The SSH *username* selects the variant, so the "path" lives in the address:
//
//   ssh komputery@localhost -p 2222   # default palette
//   ssh crt@localhost -p 2222         # terminal-green palette
//   ssh hot@localhost -p 2222         # red/orange/yellow palette
//   ssh spectrum@localhost -p 2222    # spectrum colour mode
//
// Any auth is accepted (it's a viewer, not a shop… yet). q / Ctrl+C quits.
// The host key is generated on first run into scripts/ssh-sketch/.host-key
// (gitignored).

import fs from "fs";
import path from "path";
import {
  generateKeyPairSync
} from "crypto";
import {
  fileURLToPath
} from "url";

import {
  ENTER_SCREEN,
  LEAVE_SCREEN,
  PALETTES,
  startLoop
} from "./renderer.mjs";

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const HOST_KEY_PATH = path.join(
  __dirname,
  ".host-key"
);
const PORT = Number( process.env.SSH_SKETCH_PORT ) || 2222;

let ssh2;

try {
  const imported = await import( "ssh2" );

  ssh2 = imported.default ?? imported;
} catch {
  console.error( "The ssh2 package is required for the SSH server:" );
  console.error( "  npm install --save-dev ssh2" );
  console.error( "(or try the renderer without SSH: node scripts/ssh-sketch/local.mjs)" );
  process.exit( 1 );
}

function loadHostKey( ) {
  if ( fs.existsSync( HOST_KEY_PATH ) ) {
    return fs.readFileSync( HOST_KEY_PATH );
  }

  const {
    privateKey
  } = generateKeyPairSync(
    "rsa",
    {
      modulusLength: 2048,
      privateKeyEncoding: {
        type: "pkcs1",
        format: "pem"
      },
      publicKeyEncoding: {
        type: "pkcs1",
        format: "pem"
      }
    }
  );

  fs.writeFileSync(
    HOST_KEY_PATH,
    privateKey,
    {
      mode: 0o600
    }
  );

  return privateKey;
}

// The SSH username picks the sketch variant — palettes by name, plus
// "spectrum" for the banded colour mode.
function overridesForUser( username = "" ) {
  const name = username.toLowerCase( );

  if ( name === "spectrum" ) {
    return {
      colorMode: "spectrum"
    };
  }

  if ( PALETTES[ name ] ) {
    return {
      palette: name
    };
  }

  return {};
}

const server = new ssh2.Server(
  {
    hostKeys: [
      loadHostKey( )
    ]
  },
  ( client ) => {
    let username = "";

    client.on(
      "authentication",
      ( ctx ) => {
        username = ctx.username || "";
        ctx.accept( );
      }
    );

    client.on(
      "error",
      ( error ) => {
        console.error(
          "client error:",
          error.message
        );
      }
    );

    client.on(
      "ready",
      ( ) => {
        client.on(
          "session",
          ( acceptSession ) => {
            const session = acceptSession( );
            const size = {
              cols: 80,
              rows: 24
            };

            session.on(
              "pty",
              (
                acceptPty, rejectPty, info
              ) => {
                size.cols = info.cols || 80;
                size.rows = info.rows || 24;
                acceptPty?.( );
              }
            );

            session.on(
              "window-change",
              (
                acceptResize, rejectResize, info
              ) => {
                size.cols = info.cols || size.cols;
                size.rows = info.rows || size.rows;
                acceptResize?.( );
              }
            );

            session.on(
              "shell",
              ( acceptShell ) => {
                const stream = acceptShell( );

                stream.write( ENTER_SCREEN );

                const stop = startLoop( {
                  write: ( chunk ) => stream.write( chunk ),
                  getSize: ( ) => size,
                  overrides: overridesForUser( username )
                } );

                const quit = ( ) => {
                  stop( );
                  stream.write( LEAVE_SCREEN );
                  stream.end( );
                };

                stream.on(
                  "data",
                  ( data ) => {
                    const key = data.toString( );

                    if ( key === "q" || key === "\x03" ) {
                      quit( );
                    }
                  }
                );

                stream.on(
                  "close",
                  ( ) => stop( )
                );
              }
            );
          }
        );
      }
    );
  }
);

server.listen(
  PORT,
  "0.0.0.0",
  ( ) => {
    console.log( `ssh-sketch listening on port ${ PORT }` );
    console.log( `  ssh komputery@localhost -p ${ PORT }` );
    console.log( `  ssh crt@localhost -p ${ PORT }` );
    console.log( `  ssh hot@localhost -p ${ PORT }` );
    console.log( `  ssh spectrum@localhost -p ${ PORT }` );
  }
);
