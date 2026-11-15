"use client";

import React, {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  createPortal
} from "react-dom";
import clsx from "clsx";
import {
  PROVIDER_LABEL, type Provider
} from "@/lib/postiz/client";
import {
  parseTemplate, pillDef, serializeTemplate, type PillContext, type PillDef, type Segment
} from "@/lib/postiz/pills";

/** What a palette needs to put a pill into the text he last typed in. */
export interface PillEditorHandle {
  insert: ( key: string, opts?: Record<string, string> ) => void;
  focus: () => void;
  label: string;
}

/** Dragged from the palette or from a text: the pill and its options. */
export const PILL_MIME = "application/x-sketchbook-pill";

const FAMILY_CLASS: Record<PillDef[ "family" ], string> = {
  sketch: "border-sky-500/50 bg-sky-500/10 dark:border-sky-300/50 dark:bg-sky-300/10",
  piece: "border-violet-500/50 bg-violet-500/10 dark:border-violet-300/50 dark:bg-violet-300/10",
  post: "border-teal-500/50 bg-teal-500/10 dark:border-teal-300/50 dark:bg-teal-300/10",
  mine: "border-orange-500/50 bg-orange-500/10 dark:border-orange-300/50 dark:bg-orange-300/10"
};
const DOT_CLASS: Record<PillDef[ "family" ], string> = {
  sketch: "bg-sky-500 dark:bg-sky-300",
  piece: "bg-violet-500 dark:bg-violet-300",
  post: "bg-teal-500 dark:bg-teal-300",
  mine: "bg-orange-500 dark:bg-orange-300"
};

export function pillClasses(
  def: PillDef, empty: boolean
): string {
  return clsx(
    "inline-flex select-none items-center gap-1 whitespace-nowrap rounded-full border px-2 align-baseline text-xs font-medium leading-5 text-foreground",
    empty ? "border-dashed border-foreground/30 bg-transparent text-foreground/50" : FAMILY_CLASS[ def.family ]
  );
}

export function PillDot( {
  def, empty
}: {
  def: PillDef;
  empty?: boolean;
} ) {
  return (
    <span
      aria-hidden="true"
      className={ clsx(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        empty ? "border border-dashed border-foreground/40" : DOT_CLASS[ def.family ]
      ) }
    />
  );
}

const FORMATS: [string, string][] = [
  [
    "",
    "15 Nov"
  ],
  [
    "long",
    "Sunday 15 November"
  ],
  [
    "num",
    "15/11/2026"
  ],
  [
    "month",
    "November 2026"
  ]
];
const NETWORKS: Provider[] = [
  "instagram",
  "tiktok",
  "youtube",
  "threads",
  "x",
  "bluesky"
];

function optionWords( opts: Record<string, string> ): string {
  return [
    opts.fmt && FORMATS.find( ( [
      f
    ] ) => f === opts.fmt )?.[ 1 ].split( " " )[ 0 ],
    opts.count && `${ opts.count }`,
    opts.case === "upper" && "ABC",
    opts.inbio === "off" && "URL",
    opts.nets && `${ opts.nets.split( "," ).length } nets`
  ].filter( Boolean ).join( " · " );
}

/**
 * One caption template as text with PILLS (labs 4–6): a pill is an
 * uneditable chip carrying `data-pill` and its options, and the text around
 * it is ordinary typing. The DOM is the editor's own — React renders the
 * shell once and rebuilds the content only when the template changes from
 * outside (a template button, a reset), never on his own keystrokes, which
 * would throw the caret away.
 *
 * Enter is a line break, a paste is plain text, `/` opens a search of every
 * pill, a click on a pill opens its options, a pill is dragged to move it and
 * the palette's pills are dropped in.
 */
export default function PillEditor( {
  id, label, value, ctx, palette, small, onChange, onActive, onMount
}: {
  id: string;
  label: string;
  value: string;
  ctx: PillContext;
  palette: readonly PillDef[];
  small?: boolean;
  onChange: ( template: string ) => void;
  /** Focused: the palette now adds to this text. */
  onActive?: ( handle: PillEditorHandle ) => void;
  /** Mounted: the text the palette adds to before any other was focused. */
  onMount?: ( handle: PillEditorHandle ) => void;
} ) {
  const ref = useRef<HTMLDivElement | null>( null );
  const emitted = useRef<string | null>( null );
  const saved = useRef<Range | null>( null );
  const ctxRef = useRef( ctx );
  const [
    popover,
    setPopover
  ] = useState<{ node: HTMLElement;
    rect: DOMRect } | null>( null );
  const [
    slash,
    setSlash
  ] = useState<DOMRect | null>( null );

  const paint = useCallback(
    ( node: HTMLElement ) => {
      const def = pillDef(
        node.dataset.pill ?? "",
        ctxRef.current.phrases
      );

      if ( !def ) {
        node.textContent = `{${ node.dataset.pill }}`;

        return;
      }

      const opts = JSON.parse( node.dataset.opts || "{}" ) as Record<string, string>;
      const value = def.value(
        ctxRef.current,
        opts
      );
      const words = optionWords( opts );

      node.className = clsx(
        pillClasses(
          def,
          !value
        ),
        "mx-px cursor-pointer"
      );
      node.title = value ? `${ def.label }: ${ value }` : `${ def.label }: nothing for this sketch — its line folds away`;
      node.replaceChildren( def.label );

      if ( words ) {
        const small = document.createElement( "span" );

        small.className = "font-mono text-[10px] text-label";
        small.textContent = words;
        node.append(
          " ",
          small
        );
      }
    },
    []
  );

  const pillNode = useCallback(
    (
      key: string, opts: Record<string, string> = {}
    ) => {
      const node = document.createElement( "span" );

      node.contentEditable = "false";
      node.draggable = true;
      node.dataset.pill = key;
      node.dataset.opts = JSON.stringify( opts );
      paint( node );

      return node;
    },
    [
      paint
    ]
  );

  const read = useCallback(
    (): string => {
      const out: Segment[] = [];
      const walk = ( parent: Node ) => {
        parent.childNodes.forEach( ( c ) => {
          if ( c.nodeType === Node.TEXT_NODE ) {
            const text = ( c.nodeValue ?? "" ).replace(
              /​/g,
              ""
            );

            if ( text ) {
              out.push( {
                text
              } );
            }
          } else if ( c instanceof HTMLElement && c.dataset.pill ) {
            out.push( {
              pill: c.dataset.pill,
              opts: JSON.parse( c.dataset.opts || "{}" ) as Record<string, string>
            } );
          } else if ( c.nodeName === "BR" ) {
            out.push( {
              text: "\n"
            } );
          } else {
            if ( c.nodeName === "DIV" && out.length ) {
              out.push( {
                text: "\n"
              } );
            }

            walk( c );
          }
        } );
      };

      if ( ref.current ) {
        walk( ref.current );
      }

      return serializeTemplate( out );
    },
    []
  );

  const emit = useCallback(
    () => {
      const next = read();

      emitted.current = next;
      onChange( next );
    },
    [
      onChange,
      read
    ]
  );

  // Rebuilt only when the template changed from outside.
  useEffect(
    () => {
      const el = ref.current;

      if ( !el || value === emitted.current ) {
        return;
      }

      emitted.current = value;
      el.replaceChildren( ...parseTemplate( value ).map( ( s ) => "text" in s ? document.createTextNode( s.text ) : pillNode(
        s.pill,
        s.opts
      ) ) );
    },
    [
      value,
      pillNode
    ]
  );

  // A new sketch or new phrases: the pills say their new values.
  useEffect(
    () => {
      ctxRef.current = ctx;
      ref.current?.querySelectorAll<HTMLElement>( "[data-pill]" ).forEach( paint );
    },
    [
      ctx,
      paint
    ]
  );

  useEffect(
    () => {
      const keep = () => {
        const sel = document.getSelection();

        if ( sel?.rangeCount && ref.current?.contains( sel.getRangeAt( 0 ).startContainer ) ) {
          saved.current = sel.getRangeAt( 0 ).cloneRange();
        }
      };

      document.addEventListener(
        "selectionchange",
        keep
      );

      return () => document.removeEventListener(
        "selectionchange",
        keep
      );
    },
    []
  );

  const place = useCallback(
    (
      node: Node, range?: Range | null
    ) => {
      const el = ref.current;

      if ( !el ) {
        return;
      }

      const r = range && el.contains( range.startContainer ) ? range : saved.current && el.contains( saved.current.startContainer ) ? saved.current : null;

      if ( r ) {
        r.deleteContents();
        r.insertNode( node );
      } else {
        el.append( node );
      }

      const after = document.createRange();

      after.setStartAfter( node );
      after.collapse( true );

      const sel = document.getSelection();

      sel?.removeAllRanges();
      sel?.addRange( after );
      saved.current = after.cloneRange();
    },
    []
  );

  const insert = useCallback(
    (
      key: string, opts: Record<string, string> = {}, range?: Range | null
    ) => {
      place(
        pillNode(
          key,
          opts
        ),
        range
      );
      emit();
    },
    [
      emit,
      pillNode,
      place
    ]
  );

  const handle = useCallback(
    (): PillEditorHandle => ( {
      insert: (
        key, opts
      ) => {
        ref.current?.focus( {
          preventScroll: true
        } );
        insert(
          key,
          opts
        );
      },
      focus: () => ref.current?.focus(),
      label
    } ),
    [
      insert,
      label
    ]
  );

  useEffect(
    () => {
      onMount?.( handle() );
    },
    [
      handle,
      onMount
    ]
  );

  const rangeAt = (
    x: number, y: number
  ): Range | null => {
    const doc = document as Document & { caretPositionFromPoint?: ( x: number, y: number ) => { offsetNode: Node;
      offset: number } | null };

    if ( doc.caretPositionFromPoint ) {
      const p = doc.caretPositionFromPoint(
        x,
        y
      );

      if ( p ) {
        const r = document.createRange();

        r.setStart(
          p.offsetNode,
          p.offset
        );

        return r;
      }
    }

    return document.caretRangeFromPoint?.(
      x,
      y
    ) ?? null;
  };

  return (
    <>
      <div
        ref={ ref }
        id={ id }
        role="textbox"
        aria-multiline="true"
        aria-label={ label }
        contentEditable
        suppressContentEditableWarning
        spellCheck
        tabIndex={ 0 }
        onFocus={ () => onActive?.( handle() ) }
        onInput={ emit }
        onKeyDown={ ( event ) => {
          if ( event.key === "Enter" ) {
            event.preventDefault();

            const nl = document.createTextNode( "\n" );

            place(
              nl,
              document.getSelection()?.rangeCount ? document.getSelection()!.getRangeAt( 0 ) : null
            );

            // A trailing line break shows only with something after it.
            if ( !nl.nextSibling ) {
              place( document.createTextNode( "​" ) );
            }

            emit();
          } else if ( event.key === "/" ) {
            const sel = document.getSelection();
            const at = sel?.rangeCount ? sel.getRangeAt( 0 ) : null;
            const before = at && at.startContainer.nodeType === Node.TEXT_NODE ? ( at.startContainer.nodeValue ?? "" ).slice(
              0,
              at.startOffset
            ) : "";

            // Mid-word (a URL, «1/2») a slash is a slash.
            if ( /\S$/.test( before.replace(
              /\u200B/g,
              ""
            ) ) ) {
              return;
            }

            event.preventDefault();
            // The pill lands where the slash was typed, whatever selectionchange has said so far.
            saved.current = at ? at.cloneRange() : saved.current;

            const rect = sel?.rangeCount ? sel.getRangeAt( 0 ).getBoundingClientRect() : null;

            setSlash( rect && ( rect.width || rect.height ) ? rect : ref.current!.getBoundingClientRect() );
          }
        } }
        onPaste={ ( event ) => {
          event.preventDefault();
          place(
            document.createTextNode( event.clipboardData.getData( "text/plain" ) ),
            document.getSelection()?.rangeCount ? document.getSelection()!.getRangeAt( 0 ) : null
          );
          emit();
        } }
        onClick={ ( event ) => {
          const node = ( event.target as HTMLElement ).closest<HTMLElement>( "[data-pill]" );

          if ( node ) {
            event.preventDefault();
            setPopover( {
              node,
              rect: node.getBoundingClientRect()
            } );
          }
        } }
        onDragStart={ ( event ) => {
          const node = ( event.target as HTMLElement ).closest?.<HTMLElement>( "[data-pill]" );

          if ( node ) {
            node.dataset.moving = "1";
            event.dataTransfer.setData(
              PILL_MIME,
              JSON.stringify( {
                key: node.dataset.pill,
                opts: JSON.parse( node.dataset.opts || "{}" )
              } )
            );
            event.dataTransfer.effectAllowed = "move";
          }
        } }
        onDragEnd={ () => {
          ref.current?.querySelectorAll<HTMLElement>( "[data-moving]" ).forEach( ( n ) => delete n.dataset.moving );
        } }
        onDragOver={ ( event ) => {
          if ( event.dataTransfer.types.includes( PILL_MIME ) ) {
            event.preventDefault();
          }
        } }
        onDrop={ ( event ) => {
          const raw = event.dataTransfer.getData( PILL_MIME );

          if ( !raw ) {
            return;
          }

          event.preventDefault();

          const {
            key, opts
          } = JSON.parse( raw ) as { key: string;
            opts?: Record<string, string> };

          ref.current?.querySelectorAll<HTMLElement>( "[data-moving]" ).forEach( ( n ) => n.remove() );
          ref.current?.focus( {
            preventScroll: true
          } );
          insert(
            key,
            opts ?? {},
            rangeAt(
              event.clientX,
              event.clientY
            )
          );
        } }
        className={ clsx(
          "w-full overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-theme bg-background px-3 py-2 text-base leading-[1.9] text-foreground focus:border-foreground focus:outline-hidden sm:text-sm",
          small ? "min-h-16" : "min-h-28"
        ) }
      />
      {popover && (
        <PillOptions
          node={ popover.node }
          rect={ popover.rect }
          ctx={ ctx }
          onChange={ () => {
            paint( popover.node );
            emit();
          } }
          onRemove={ () => {
            popover.node.remove();
            setPopover( null );
            emit();
          } }
          onClose={ () => setPopover( null ) }
        />
      )}
      {slash && (
        <PillSearch
          rect={ slash }
          palette={ palette }
          ctx={ ctx }
          onPick={ ( key ) => {
            setSlash( null );
            ref.current?.focus( {
              preventScroll: true
            } );
            insert( key );
          } }
          onClose={ () => {
            setSlash( null );
            ref.current?.focus();
          } }
        />
      )}
    </>
  );
}

function Floating( {
  rect, onClose, label, children
}: {
  rect: DOMRect;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
} ) {
  const ref = useRef<HTMLDivElement | null>( null );
  const [
    pos,
    setPos
  ] = useState<{ left: number;
    top: number } | null>( null );

  useEffect(
    () => {
      const el = ref.current;

      if ( !el ) {
        return;
      }

      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const below = rect.bottom + 6;

      setPos( {
        left: Math.max(
          12,
          Math.min(
            rect.left,
            window.innerWidth - w - 12
          )
        ),
        top: below + h > window.innerHeight - 8 ? Math.max(
          8,
          rect.top - h - 6
        ) : below
      } );
    },
    [
      rect
    ]
  );

  useEffect(
    () => {
      const away = ( event: PointerEvent ) => {
        if ( ref.current && !ref.current.contains( event.target as Node ) ) {
          onClose();
        }
      };
      const key = ( event: KeyboardEvent ) => {
        if ( event.key === "Escape" ) {
          event.stopPropagation();
          onClose();
        }
      };

      document.addEventListener(
        "pointerdown",
        away,
        true
      );
      document.addEventListener(
        "keydown",
        key,
        true
      );

      return () => {
        document.removeEventListener(
          "pointerdown",
          away,
          true
        );
        document.removeEventListener(
          "keydown",
          key,
          true
        );
      };
    },
    [
      onClose
    ]
  );

  return createPortal(
    <div
      ref={ ref }
      role="dialog"
      aria-label={ label }
      style={ {
        left: pos?.left ?? rect.left,
        top: pos?.top ?? rect.bottom + 6,
        opacity: pos ? 1 : 0
      } }
      className="fixed z-[120] flex w-[min(300px,calc(100vw-24px))] flex-col gap-2 rounded-xl border border-theme bg-background p-2.5 text-xs text-foreground shadow-lg"
    >
      {children}
    </div>,
    document.body
  );
}

/** A pill keeps its options on its own node, where `read` finds them. */
function writeOpts(
  node: HTMLElement, opts: Record<string, string>
): void {
  node.dataset.opts = JSON.stringify( opts );
}

/** A pill's options: what it says now, its format, how many, its case, the link's in-bio, day 1, where it shows, Remove. */
function PillOptions( {
  node, rect, ctx, onChange, onRemove, onClose
}: {
  node: HTMLElement;
  rect: DOMRect;
  ctx: PillContext;
  onChange: () => void;
  onRemove: () => void;
  onClose: () => void;
} ) {
  const def = pillDef(
    node.dataset.pill ?? "",
    ctx.phrases
  );
  const [
    opts,
    setOpts
  ] = useState<Record<string, string>>( () => JSON.parse( node.dataset.opts || "{}" ) as Record<string, string> );

  if ( !def ) {
    return null;
  }

  const set = (
    k: string, v: string
  ) => {
    const next = {
      ...opts
    };

    if ( v ) {
      next[ k ] = v;
    } else {
      delete next[ k ];
    }

    writeOpts(
      node,
      next
    );
    setOpts( next );
    onChange();
  };
  const value = def.value(
    ctx,
    opts
  );
  const nets = opts.nets ? opts.nets.split( "," ) : NETWORKS;
  const select = "rounded-md border border-theme bg-background px-1.5 py-1 text-xs text-foreground pointer-coarse:min-h-10";

  return (
    <Floating rect={ rect } onClose={ onClose } label={ `${ def.label } options` }>
      <span className="flex items-center gap-2 font-semibold">
        <PillDot def={ def } empty={ !value } />
        {def.label}
      </span>
      <span className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-hover/60 px-2 py-1.5 font-mono text-[11px] text-foreground/80">
        {value || "Nothing for this sketch: the line it sits on folds away."}
      </span>
      <span className="text-[11px] text-label">From {def.source}.</span>
      {def.options?.includes( "fmt" ) && (
        <label className="flex items-center justify-between gap-2">
          Format
          <select className={ select } value={ opts.fmt ?? "" } onChange={ ( e ) => set(
            "fmt",
            e.target.value
          ) }
          >
            {FORMATS.map( ( [
              f,
              l
            ] ) => <option key={ f } value={ f }>{l}</option> )}
          </select>
        </label>
      )}
      {def.options?.includes( "count" ) && (
        <label className="flex items-center justify-between gap-2">
          How many
          <select className={ select } value={ opts.count ?? "" } onChange={ ( e ) => set(
            "count",
            e.target.value
          ) }
          >
            <option value="">All</option>
            {[
              "1",
              "2",
              "3",
              "5"
            ].map( ( n ) => <option key={ n } value={ n }>{n}</option> )}
          </select>
        </label>
      )}
      {def.options?.includes( "case" ) && (
        <label className="flex items-center justify-between gap-2">
          Case
          <select className={ select } value={ opts.case ?? "" } onChange={ ( e ) => set(
            "case",
            e.target.value
          ) }
          >
            <option value="">As written</option>
            <option value="upper">UPPERCASE</option>
          </select>
        </label>
      )}
      {def.options?.includes( "inbio" ) && (
        <label className="flex items-center justify-between gap-2">
          <span>Instagram and TikTok say your <b>Link in bio</b> phrase</span>
          <input type="checkbox" checked={ opts.inbio !== "off" } onChange={ ( e ) => set(
            "inbio",
            e.target.checked ? "" : "off"
          ) }
          />
        </label>
      )}
      {def.options?.includes( "start" ) && (
        <span className="text-[11px] text-label">Day 1 is set in Publishing (Menu › Connections › Publishing).</span>
      )}
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-label">Shows on</span>
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {NETWORKS.map( ( n ) => (
          <label key={ n } className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={ nets.includes( n ) }
              onChange={ ( e ) => {
                const next = e.target.checked ? [
                  ...nets,
                  n
                ] : nets.filter( ( x ) => x !== n );

                set(
                  "nets",
                  next.length === NETWORKS.length ? "" : next.join( "," )
                );
              } }
            />
            {PROVIDER_LABEL[ n ]}
          </label>
        ) )}
      </span>
      <span className="flex items-center justify-between pt-1">
        <button type="button" onClick={ onRemove } className="text-xs text-red-500 underline underline-offset-2">Remove</button>
        <button type="button" onClick={ onClose } className="rounded-md border border-theme px-2.5 py-1 text-xs hover:bg-hover pointer-coarse:min-h-10">Done</button>
      </span>
    </Floating>
  );
}

/** `/` in a text: every pill, searched by name or family, with what it says for this sketch. */
function PillSearch( {
  rect, palette, ctx, onPick, onClose
}: {
  rect: DOMRect;
  palette: readonly PillDef[];
  ctx: PillContext;
  onPick: ( key: string ) => void;
  onClose: () => void;
} ) {
  const [
    query,
    setQuery
  ] = useState( "" );
  const [
    selected,
    setSelected
  ] = useState( 0 );
  const q = query.toLowerCase();
  const list = palette.filter( ( p ) => !q || p.label.toLowerCase().includes( q ) || p.key.toLowerCase().includes( q ) ).slice(
    0,
    12
  );

  return (
    <Floating rect={ rect } onClose={ onClose } label="Add a pill">
      <input
        autoFocus
        value={ query }
        placeholder="Find a pill…"
        aria-label="Find a pill"
        onChange={ ( e ) => {
          setQuery( e.target.value );
          setSelected( 0 );
        } }
        onKeyDown={ ( e ) => {
          if ( e.key === "ArrowDown" ) {
            e.preventDefault();
            setSelected( ( s ) => Math.min(
              list.length - 1,
              s + 1
            ) );
          } else if ( e.key === "ArrowUp" ) {
            e.preventDefault();
            setSelected( ( s ) => Math.max(
              0,
              s - 1
            ) );
          } else if ( e.key === "Enter" && list[ selected ] ) {
            e.preventDefault();
            onPick( list[ selected ].key );
          }
        } }
        className="rounded-md border border-theme bg-background px-2 py-1.5 text-base text-foreground focus:border-foreground focus:outline-hidden sm:text-xs"
      />
      <ul role="listbox" aria-label="Pills" className="m-0 flex max-h-60 list-none flex-col gap-0.5 overflow-y-auto p-0">
        {list.map( (
          p, i
        ) => {
          const value = p.value(
            ctx,
            {}
          );

          return (
            <li key={ p.key }>
              <button
                type="button"
                role="option"
                aria-selected={ i === selected }
                onClick={ () => onPick( p.key ) }
                className={ clsx(
                  "grid w-full grid-cols-[8px_auto_minmax(0,1fr)] items-center gap-2 rounded-md px-1.5 py-1 text-left",
                  i === selected ? "bg-hover" : "hover:bg-hover"
                ) }
              >
                <PillDot def={ p } empty={ !value } />
                <span className="whitespace-nowrap text-xs font-medium">{p.label}</span>
                <span className="truncate font-mono text-[10.5px] text-label">{value || "nothing here"}</span>
              </button>
            </li>
          );
        } )}
        {!list.length && <li className="px-1.5 py-1 text-label">No pill of that name.</li>}
      </ul>
    </Floating>
  );
}
