"use client";

import {
  useCallback, useEffect, useMemo, useState
} from "react";

import {
  galleryEntryHref, stageGalleryEntry
} from "@/lib/gallery/open";
import {
  buildSends, foreignSends
} from "@/lib/gallery/sends";
import {
  getGalleryStore
} from "@/lib/gallery/store";
import type {
  GalleryEntry
} from "@/lib/gallery/types";
import {
  PostizClient, postizHome, type PostizPost
} from "@/lib/postiz/client";
import {
  allPublications, forgetPosts, subscribePublish
} from "@/lib/postiz/publishStore";
import {
  recentPosts
} from "@/lib/postiz/recentPosts";
import {
  usePostiz
} from "@/lib/postiz/usePostiz";
import SketchSheet from "./SketchSheet";

/**
 * The gallery's sketch sheet, outside the gallery (lab 3 Q5: the Export
 * dialog's «Posted 11 Nov on …» line opens it): it reads what the gallery
 * reads — the pieces, this browser's sends, Postiz's posts (shared for a
 * minute, `recentPosts`) — for ONE sketch. Opening a piece reloads the page
 * on it, since it may be the sketch already open.
 */
export default function SketchSheetLoader( {
  sketchKey, onClose
}: {
  /** `<engine>/<name>`. */
  sketchKey: string;
  onClose: () => void;
} ) {
  const conn = usePostiz();
  const [
    entries,
    setEntries
  ] = useState<GalleryEntry[]>( [] );
  const [
    posts,
    setPosts
  ] = useState<PostizPost[] | null>( null );
  const [
    publications,
    setPublications
  ] = useState( () => allPublications() );
  const [
    now
  ] = useState( () => Date.now() );
  const client = useMemo(
    () => conn ? new PostizClient(
      conn.apiBase,
      conn.apiKey
    ) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new client only for a new address or key
    [
      conn?.apiBase,
      conn?.apiKey
    ]
  );

  const read = useCallback(
    ( fresh = false ) => {
      if ( client ) {
        recentPosts(
          client,
          fresh
        ).then(
          setPosts,
          () => setPosts( [] )
        );
      }
    },
    [
      client
    ]
  );

  useEffect(
    () => {
      getGalleryStore().entries()
        .then(
          setEntries,
          () => setEntries( [] )
        );
      read();

      return subscribePublish( () => setPublications( allPublications() ) );
    },
    [
      read
    ]
  );

  const sends = useMemo(
    () => [
      ...buildSends( {
        publications,
        posts,
        channels: conn?.channels ?? [],
        entries,
        now
      } ),
      ...( posts ? foreignSends(
        posts,
        publications
      ) : [] )
    ].sort( (
      a, b
    ) => b.at - a.at ),
    [
      publications,
      posts,
      conn?.channels,
      entries,
      now
    ]
  );

  return (
    <SketchSheet
      target={ {
        sketchKey,
        pieceId: null,
        sendKey: null
      } }
      entries={ entries }
      sends={ sends }
      tz={ conn?.rhythm.timeZone ?? "Europe/Paris" }
      postizUrl={ conn ? postizHome( conn.apiBase ) : null }
      onClose={ onClose }
      onOpenPiece={ ( entry ) => {
        stageGalleryEntry( entry );
        window.location.assign( galleryEntryHref( entry ) );
      } }
      onOpenSketch={ onClose }
      onTakeBack={ client ? async(
        send, postIds
      ) => {
        const gone: string[] = [];
        let failure: unknown = null;

        for ( const id of postIds ) {
          try {
            await client.deletePost( id );
            gone.push( id );
          } catch( caught ) {
            failure = caught;
          }
        }

        if ( gone.length ) {
          forgetPosts(
            send.sketchKey,
            gone
          );
        }

        read( true );

        if ( failure ) {
          throw failure;
        }
      } : null }
      onSendAgain={ null }
    />
  );
}
