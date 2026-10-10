/**
 * The deck: list, add, duplicate, remove, reorder, select and rename slides —
 * every one through `useSlideManagement`'s own handler, the one the filmstrip
 * calls, so a slide made by an agent inherits what a click's would (the active
 * slide's settings, its bindings, a thumbnail).
 */
import {
  CommandError, isRecord, type CommandSpec
} from "../../../../scripts/mcp/registry.ts";
import type {
  StudioHandles
} from "../handles";

const INDEX = {
  type: "number" as const,
  description: "Slide index (slides.list shows them)",
  min: 0,
  max: 999,
  integer: true
};

function slidesOf( h: StudioHandles ): Record<string, unknown>[] {
  const slides = h.getValues( "slides" );

  return Array.isArray( slides ) ? slides as Record<string, unknown>[] : [];
}

function existing(
  h: StudioHandles, index: unknown
): number {
  const count = slidesOf( h ).length;

  if ( ( index as number ) >= count ) {
    throw new CommandError(
      "invalid",
      count ? `slide ${ String( index ) } does not exist — slides 0 to ${ count - 1 }` : "this piece has no slides — slides.add makes one"
    );
  }

  return index as number;
}

/**
 * Wait until `done()` holds: the handlers land their writes and the selection
 * a render or a slide transition later. Resolves false past `ms`.
 */
export async function until(
  done: () => boolean, ms = 3000
): Promise<boolean> {
  const start = Date.now();

  while ( !done() ) {
    if ( Date.now() - start > ms ) {
      return false;
    }
    await new Promise( ( resolve ) => setTimeout(
      resolve,
      25
    ) );
  }

  return true;
}

/**
 * The slide `handleDeleteSlide` selects once `index` is gone: the same one
 * (shifted) when another was deleted, its successor when it was the active
 * one, the root when the deck is empty.
 */
export function activeAfterRemoval(
  active: number | undefined, index: number, length: number
): number | undefined {
  if ( length === 0 ) {
    return undefined;
  }
  if ( active === undefined || index > active ) {
    return active;
  }

  return Math.min(
    index === active ? active : active - 1,
    length - 1
  );
}

function summary( h: StudioHandles ) {
  const active = h.activeSlide();

  return {
    slides: slidesOf( h ).map( (
      slide, index
    ) => ( {
      index,
      name: typeof slide.name === "string" ? slide.name : null,
      active: index === active,
      contentItems: Array.isArray( slide.content ) ? slide.content.length : 0,
      size: isRecord( slide.size ) ? slide.size : null
    } ) ),
    activeSlide: active ?? null
  };
}

export function slideCommands( h: StudioHandles ): CommandSpec[] {
  return [
    {
      id: "slides.list",
      title: "List slides",
      description: "The deck: each slide's index, name, size and number of content items, and which one is on screen. A piece with no slides edits its root.",
      run: () => summary( h )
    },
    {
      id: "slides.add",
      title: "Add a slide",
      description: "Append a slide, as the filmstrip's + does: it starts from what is on screen (the active slide's parameters, size, clock and bindings) and becomes the active slide. The first slide turns the root into slide 0's starting point.",
      async run() {
        const before = slidesOf( h ).length;

        h.slides.add();
        if ( !await until( () => slidesOf( h ).length === before + 1 && h.activeSlide() === before ) ) {
          throw new CommandError(
            "failed",
            "the slide did not appear — the studio may still be adding the previous one"
          );
        }

        return {
          added: before,
          ...summary( h )
        };
      }
    },
    {
      id: "slides.duplicate",
      title: "Duplicate a slide",
      description: "Copy a slide — its parameters, content and bindings — right after itself, and show the copy.",
      params: {
        index: INDEX
      },
      async run( params ) {
        const index = existing(
          h,
          params.index
        );
        const before = slidesOf( h ).length;

        h.slides.duplicate( index );
        await until( () => slidesOf( h ).length === before + 1 && h.activeSlide() === index + 1 );

        return {
          added: index + 1,
          ...summary( h )
        };
      }
    },
    {
      id: "slides.remove",
      title: "Delete a slide",
      description: "Delete a slide. Deleting the only slide folds it back into the root (its parameters, content and bindings kept), as the filmstrip does. Undoable.",
      params: {
        index: INDEX
      },
      async run( params ) {
        const index = existing(
          h,
          params.index
        );
        const before = slidesOf( h ).length;

        const expected = activeAfterRemoval(
          h.activeSlide(),
          index,
          before - 1
        );

        h.slides.remove( index );
        // The re-selection waits on the outgoing slide's thumbnail capture.
        await until( () => slidesOf( h ).length === before - 1 && h.activeSlide() === expected );

        return {
          removed: index,
          ...summary( h )
        };
      }
    },
    {
      id: "slides.move",
      title: "Reorder slides",
      description: "Move the slide at `from` to `to` (the others shift), and show it.",
      params: {
        from: INDEX,
        to: INDEX
      },
      async run( params ) {
        const from = existing(
          h,
          params.from
        );
        const to = existing(
          h,
          params.to
        );

        if ( from !== to ) {
          h.slides.move(
            from,
            to
          );
          await until( () => h.activeSlide() === to );
        }

        return summary( h );
      }
    },
    {
      id: "slides.select",
      title: "Show a slide",
      description: "Put a slide on screen and in the editor, as clicking it in the filmstrip does. Commands without a slide then address it.",
      params: {
        index: INDEX
      },
      async run( params ) {
        const index = existing(
          h,
          params.index
        );

        h.slides.select( index );
        if ( !await until( () => h.activeSlide() === index ) ) {
          throw new CommandError(
            "failed",
            `slide ${ index } did not come on screen`
          );
        }

        return summary( h );
      }
    },
    {
      id: "slides.rename",
      title: "Rename a slide",
      description: "Give a slide a name, as shown in the filmstrip.",
      params: {
        index: INDEX,
        name: {
          type: "string",
          description: "The new name, 1–60 characters"
        }
      },
      run( params ) {
        const index = existing(
          h,
          params.index
        );
        const name = String( params.name ).trim();

        if ( !name || name.length > 60 ) {
          throw new CommandError(
            "invalid",
            "a slide name is 1 to 60 characters"
          );
        }
        h.slides.rename(
          index,
          name
        );

        return {
          index,
          name
        };
      }
    }
  ];
}
