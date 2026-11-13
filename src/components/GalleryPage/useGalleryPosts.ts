"use client";

import {
  useCallback, useEffect, useMemo, useState
} from "react";

import {
  PostizClient, type PostizPost
} from "@/lib/postiz/client";
import {
  allPublications, subscribePublish, type Publication
} from "@/lib/postiz/publishStore";
import {
  usePostiz
} from "@/lib/postiz/usePostiz";
import {
  recentPosts
} from "@/lib/postiz/recentPosts";

export interface GalleryPosts {
  /** The kept Postiz; null without one (and on the server). */
  conn: ReturnType<typeof usePostiz>;
  client: PostizClient | null;
  /** Every post Postiz lists over the window — ANY app's: the rhythm counts them all. Null until read, or without a Postiz. */
  posts: PostizPost[] | null;
  /** Why the read failed, said in the page's one status line. */
  error: string | null;
  /** True while Postiz is being asked. */
  asking: boolean;
  publications: { key: string;
    publication: Publication }[];
  /** Read Postiz again (after a Take back). */
  reload: ( fresh?: boolean ) => Promise<void>;
}

/**
 * The gallery's side of Postiz: the sends this browser kept (live, through
 * the publish store) and what Postiz lists — read ONCE when the page opens
 * (lab 3 Q6), over 5 weeks back and 8 ahead, straight from the tab like every
 * Postiz request here (`publishing.md`: the key never reaches the server).
 */
export function useGalleryPosts(): GalleryPosts {
  const conn = usePostiz();
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
  const [
    read,
    setRead
  ] = useState<{ posts: PostizPost[] | null;
    error: string | null;
    asking: boolean }>( {
    posts: null,
    error: null,
    asking: false
  } );
  const [
    publications,
    setPublications
  ] = useState<GalleryPosts[ "publications" ]>( [] );

  useEffect(
    () => {
      const sync = () => setPublications( allPublications() );

      sync();

      return subscribePublish( sync );
    },
    []
  );

  const reload = useCallback(
    async( fresh = false ) => {
      if ( !client ) {
        return;
      }

      setRead( ( r ) => ( {
        ...r,
        asking: true
      } ) );

      try {
        const posts = await recentPosts(
          client,
          fresh
        );

        setRead( {
          posts,
          error: null,
          asking: false
        } );
      } catch( caught ) {
        setRead( {
          posts: null,
          error: caught instanceof Error ? caught.message : String( caught ),
          asking: false
        } );
      }
    },
    [
      client
    ]
  );

  useEffect(
    () => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the one read when the page opens
      void reload();
    },
    [
      reload
    ]
  );

  return {
    conn,
    client,
    ...read,
    publications,
    reload
  };
}
