"use client";

import {
  useEffect, useRef, useState, useCallback
} from "react";
import {
  useRouter
} from "next/navigation";

type UseUnsavedChangesOptions = {
  hasUnsavedChanges: boolean;
  onSaveAsDraft?: () => Promise<void>;
};

/**
 * Hook that detects navigation attempts and shows a confirmation modal
 * when there are unsaved changes
 */
export function useUnsavedChanges( {
  hasUnsavedChanges,
  onSaveAsDraft,
}: UseUnsavedChangesOptions ) {
  const router = useRouter();
  const [
    showModal,
    setShowModal
  ] = useState( false );
  const [
    pendingNavigation,
    setPendingNavigation
  ] = useState<string | null>( null );
  const isNavigatingRef = useRef( false );
  const shouldBlockRef = useRef( false );

  // Update block status when hasUnsavedChanges changes
  useEffect(
    () => {
      shouldBlockRef.current = hasUnsavedChanges;
    },
    [
      hasUnsavedChanges
    ]
  );

  // Handle browser navigation (back/forward/refresh/close tab)
  useEffect(
    () => {
      if ( !hasUnsavedChanges ) return;

      const handleBeforeUnload = ( e: BeforeUnloadEvent ) => {
        e.preventDefault();
        e.returnValue = "";
        return "";
      };

      window.addEventListener(
        "beforeunload",
        handleBeforeUnload
      );

      return () => {
        window.removeEventListener(
          "beforeunload",
          handleBeforeUnload
        );
      };
    },
    [
      hasUnsavedChanges
    ]
  );

  // Intercept all link clicks globally (both <a> tags and Next.js <Link> components)
  useEffect(
    () => {
      const handleClick = ( e: MouseEvent ) => {
      // Skip if no unsaved changes or already navigating
        if ( !shouldBlockRef.current || isNavigatingRef.current ) return;

        const target = e.target as HTMLElement;
        // Check for both regular <a> tags and Next.js Link components
        const link = target.closest( "a" );

        if ( !link ) return;

        // Skip download links (blob URLs or links with download attribute)
        if (
          link.hasAttribute( "download" ) ||
        link.getAttribute( "data-download-link" ) === "true"
        ) {
          return;
        }

        const href = link.getAttribute( "href" );

        if ( !href ) return;

        // Skip blob URLs (used for downloads)
        if ( href.startsWith( "blob:" ) ) return;

        // Check if it's a navigation link (not same page anchor)
        if ( href.startsWith( "#" ) ) return;

        // Check if it's an external link (allow those to pass through with beforeunload)
        if ( href.startsWith( "http" ) && !href.includes( window.location.hostname ) ) {
          return;
        }

        // Prevent navigation and show modal
        e.preventDefault();
        e.stopPropagation();

        setPendingNavigation( href );
        setShowModal( true );
      };

      // Capture phase to intercept before other handlers (including Next.js Link)
      document.addEventListener(
        "click",
        handleClick,
        true
      );

      return () => {
        document.removeEventListener(
          "click",
          handleClick,
          true
        );
      };
    },
    [
    ]
  ); // Empty deps - we use refs to avoid re-registering

  const handleLeaveWithoutSaving = useCallback(
    () => {
      setShowModal( false );

      if ( pendingNavigation ) {
        isNavigatingRef.current = true;
        shouldBlockRef.current = false;

        // Navigate without saving
        if ( pendingNavigation.startsWith( "http" ) ) {
          window.location.href = pendingNavigation;
        } else {
          router.push( pendingNavigation );
        }
      }

      setPendingNavigation( null );
    },
    [
      pendingNavigation,
      router
    ]
  );

  const handleStay = useCallback(
    () => {
      setShowModal( false );
      setPendingNavigation( null );
      isNavigatingRef.current = false;
    },
    [
    ]
  );

  const handleSaveAsDraft = useCallback(
    async() => {
      if ( onSaveAsDraft ) {
        try {
          await onSaveAsDraft();
          setShowModal( false );

          // Navigate after saving
          if ( pendingNavigation ) {
            isNavigatingRef.current = true;
            shouldBlockRef.current = false;

            // Use Next.js router for internal navigation, window.location for external
            if ( pendingNavigation.startsWith( "http" ) ) {
              window.location.href = pendingNavigation;
            } else {
            // Use router.push for Next.js navigation
              router.push( pendingNavigation );
            }
          }
        } catch ( error ) {
        // Failed to save
        }
      }
    },
    [
      onSaveAsDraft,
      pendingNavigation,
      router
    ]
  );

  return {
    showModal,
    handleStay,
    handleSaveAsDraft,
    handleLeaveWithoutSaving,
  };
}
