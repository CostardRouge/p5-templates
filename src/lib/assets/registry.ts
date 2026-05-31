import type {
  AssetKind
} from "./types";

const registry = new Map<string, AssetKind<any>>();

/** Register an asset kind. Re-registering the same id replaces the entry. */
export function registerAssetKind<P>( kind: AssetKind<P> ): void {
  registry.set(
    kind.id,
    kind as AssetKind<any>
  );
}

/** Get a kind by id. Throws if unknown — callers always know which kind they want. */
export function getAssetKind<P = unknown>( id: string ): AssetKind<P> {
  const kind = registry.get( id );

  if ( !kind ) {
    throw new Error( `Unknown asset kind: "${ id }". Did you forget to register it?` );
  }

  return kind as AssetKind<P>;
}

/** Returns all registered kinds in insertion order. */
export function listAssetKinds(): AssetKind<any>[] {
  return Array.from( registry.values() );
}
