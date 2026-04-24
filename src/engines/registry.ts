import type {
  EngineRegistration
} from "./types";

const engines = new Map<string, EngineRegistration>();

/* ---- public API -------------------------------------------------- */

export function registerEngine( registration: EngineRegistration ): void {
  if ( engines.has( registration.id ) ) {
    // Already registered — no-op. Happens when this module is re-imported
    // across server/client bundles or during hot-reload.
    return;
  }

  engines.set(
    registration.id,
    registration
  );
}

export function getEngine( id: string ): EngineRegistration {
  const engine = engines.get( id );

  if ( !engine ) {
    throw new Error( `Unknown engine "${ id }". Registered engines: ${ listEngineIds().join( ", " ) || "(none)" }` );
  }

  return engine;
}

export function listEngines(): EngineRegistration[] {
  return Array.from( engines.values() );
}

export function listEngineIds(): string[] {
  return Array.from( engines.keys() );
}

export function hasEngine( id: string ): boolean {
  return engines.has( id );
}
