// ── State that belongs to a sketch INSTANCE, not to its module ─────────────
//
// A sketch module is evaluated once per page, whatever the number of places it
// runs in. That was fine while "places" meant one — the page. A "sketch"
// content item (nestedSketch.js) runs the same module as a layer, several
// times over, next to the page that may be running it too, and then every
// `const sketchState = { … }` at a module's top level is one object shared by
// all of them: the last layer to set up wins its graphics buffer, a layout
// cache keyed on p.width flips on every frame between two layers of different
// sizes and rebuilds both, a GPU helper recreates its WebGL buffer every frame
// because its "current p5" keeps changing hands. Two layers of one sketch read
// as "the parameters are mixed up" and "adding the second one killed the
// frame rate", which is exactly how it was reported.
//
// The fix is not to re-evaluate the module per layer (ES modules cannot), but
// to give module-level state a per-instance backing store. Two flavours:
//
//   createKeyedStore( getKey, init )  — for runtime helpers: `.current()` is
//     the record for whatever instance is drawing right now.
//
//   createInstanceState( getKey, init ) — for sketches: a Proxy that LOOKS like
//     the plain object it replaces (`sketchState.shapes`, `state.grid = …`,
//     `Object.keys( state )`), and forwards every access to the record of the
//     instance drawing right now. That is what lets a sketch keep every line
//     that reads or writes its state, and change only the declaration.
//
// Who is "drawing right now" is the caller's business (`getKey`): sketch.js
// keys on the surface override — the layer's proxy, or a fixed token for the
// page — so the page's state survives p5 instances the way module state did,
// while the GPU helpers key on getP5() itself, because their state is GL
// resources that die with a context.

/**
 * A record per key, created on first use with `init()`, held weakly.
 *
 * Keys are objects (a surface proxy, a p5 instance); a nullish key selects the
 * `host` record, which is held strongly so it outlives any one p5 instance.
 */
export function createKeyedStore(
  getKey, init
) {
  const records = new WeakMap();
  let host = null;

  function current() {
    const key = getKey();

    if ( !key ) {
      host ??= init();

      return host;
    }

    let record = records.get( key );

    if ( !record ) {
      record = init();
      records.set(
        key,
        record
      );
    }

    return record;
  }

  return {
    current
  };
}

// JSON round-trip standing in for structuredClone where the platform lacks it
// (jsdom under Jest). JSON silently drops functions, which is exactly the case
// that must NOT pass, so the replacer refuses them.
function jsonClone( value ) {
  return JSON.parse( JSON.stringify(
    value,
    (
      _key, entry
    ) => {
      if ( typeof entry === "function" ) {
        throw new TypeError( "function" );
      }

      return entry;
    }
  ) );
}

function toInitialiser( init ) {
  if ( typeof init === "function" ) {
    return init;
  }

  const clone = typeof globalThis.structuredClone === "function"
    ? globalThis.structuredClone
    : jsonClone;

  // A plain object is accepted for convenience, cloned per instance. Anything
  // the clone cannot copy (a class instance, a function) is a sign the sketch
  // wanted an initialiser, so say so rather than silently sharing it.
  return () => {
    try {
      return clone( init );
    } catch {
      throw new TypeError( "sketch.state(): pass an initialiser function for state that holds non-cloneable values" );
    }
  };
}

/**
 * A drop-in replacement for a module-level state object.
 *
 * Returns a Proxy with no state of its own: every trap resolves the record of
 * the instance currently drawing and works on that. Property reads in a hot
 * loop pay one WeakMap lookup each — cheap, but a sketch that reads the same
 * field thousands of times per frame can hoist it into a local.
 */
export function createInstanceState(
  getKey, init
) {
  const store = createKeyedStore(
    getKey,
    toInitialiser( init )
  );
  const resolve = store.current;

  return new Proxy(
    {},
    {
      get(
        _target, prop
      ) {
        return resolve()[ prop ];
      },
      set(
        _target, prop, value
      ) {
        resolve()[ prop ] = value;

        return true;
      },
      has(
        _target, prop
      ) {
        return prop in resolve();
      },
      deleteProperty(
        _target, prop
      ) {
        return delete resolve()[ prop ];
      },
      ownKeys() {
        return Reflect.ownKeys( resolve() );
      },
      getOwnPropertyDescriptor(
        _target, prop
      ) {
        const descriptor = Object.getOwnPropertyDescriptor(
          resolve(),
          prop
        );

        // The proxy's own target is an empty object, and the Proxy invariants
        // forbid reporting a non-configurable property it does not have.
        return descriptor
          ? {
            ...descriptor,
            configurable: true
          }
          : undefined;
      }
    }
  );
}
