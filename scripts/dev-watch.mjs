#!/usr/bin/env node
import { spawn } from "child_process";

const processes = [];
let shuttingDown = false;

function killAllProcesses() {
  if ( shuttingDown ) return;
  shuttingDown = true;

  console.log( "\n👋 Shutting down all processes..." );

  for ( const proc of processes ) {
    try {
      // Kill the entire process group so child trees are cleaned up
      process.kill( -proc.pid, "SIGTERM" );
    } catch {
      try { proc.kill( "SIGTERM" ); } catch { /* already dead */ }
    }
  }

  setTimeout( () => {
    for ( const proc of processes ) {
      try {
        if ( !proc.killed ) proc.kill( "SIGKILL" );
      } catch { /* already dead */ }
    }

    process.exit( 0 );
  }, 2000 );
}

function startProcess( name, command, args = [] ) {
  console.log( `🚀 Starting ${ name }...` );

  const proc = spawn( command, args, {
    stdio: [ "ignore", "pipe", "pipe" ],
    shell: true,
    detached: true, // create a process group so we can kill the tree
  } );

  processes.push( proc );

  proc.stdout.on( "data", ( data ) => {
    process.stdout.write( `[${ name }] ${ data }` );
  } );

  proc.stderr.on( "data", ( data ) => {
    process.stderr.write( `[${ name }] ${ data }` );
  } );

  proc.on( "close", ( code ) => {
    if ( code !== 0 && code !== null && !shuttingDown ) {
      console.warn( `⚠️  ${ name } exited with code ${ code }` );
    }
  } );

  proc.on( "error", ( err ) => {
    console.error( `[${ name }] Error: ${ err.message }` );
  } );

  return proc;
}

async function main() {
  console.log( "🎬 Starting Social Templates Renderer in development mode...\n" );

  // Handle termination signals — just kill children and exit
  for ( const signal of [ "SIGINT", "SIGTERM" ] ) {
    process.on( signal, killAllProcesses );
  }

  const sketchWatcher = startProcess( "sketch-meta", "npm", [ "run", "sketch:meta" ] );
  const nextDev = startProcess( "next-dev", "npm", [ "run", "dev" ] );

  await Promise.allSettled( [
    new Promise( ( resolve ) => sketchWatcher.on( "close", resolve ) ),
    new Promise( ( resolve ) => nextDev.on( "close", resolve ) ),
  ] );
}

main().catch( ( error ) => {
  console.error( "❌ Fatal error:", error );
  process.exit( 1 );
} );