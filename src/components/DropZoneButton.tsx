import React, {
  forwardRef, useRef
} from "react";
import {
  Plus
} from "lucide-react";
import {
  HIDDEN_FILE_INPUT_CLASS
} from "@/components/hiddenFileInput";

type DropZoneButtonProps = {
  onFiles: ( files: FileList ) => void | Promise<void>;
  multiple?: boolean;
  className?: string;
  accept?: string;
};

export default forwardRef( function DropZoneButton(
  {
    onFiles,
    multiple = false,
    className = "",
    accept = "image/*"
  }: DropZoneButtonProps,
  ref: React.Ref<HTMLInputElement>
) {
  const internalRef = useRef<HTMLInputElement>( null );

  const setRef = React.useCallback(
    ( node: HTMLInputElement | null ) => {
      internalRef.current = node;
      if ( typeof ref === "function" ) {
        ref( node );
      } else if ( ref ) {
        ( ref as React.MutableRefObject<HTMLInputElement | null> ).current = node;
      }
    },
    [
      ref
    ]
  );

  return (
    <div
      // `cursor-pointer` is not decoration here: iOS Safari only synthesises a
      // bubbling click for elements it considers clickable, and a bare div with
      // a React handler is not one — React listens at the root, so the event
      // never arrives. The pointer cursor (with role/tabIndex below) is what
      // makes WebKit treat this as a tap target at all.
      className={ `border border-dashed border-theme rounded-lg h-20 p-3 flex flex-col items-center justify-center gap-2 text-foreground bg-background cursor-pointer ${ className }` }
      onClick={ ( e ) => {
        e.stopPropagation();

        // A tap that lands on the (screen-reader-only, 1px) input itself
        // already opens the picker; calling click() again would reopen it.
        if ( e.target === internalRef.current ) {
          return;
        }

        internalRef.current?.click();
      } }
      onDragOver={ ( e ) => e.preventDefault() }
      onDrop={ async( e ) => {
        e.preventDefault();

        if ( e.dataTransfer.files?.length ) {
          await onFiles( e.dataTransfer.files );
        }
      } }
      role="button"
      tabIndex={ 0 }
    >
      <Plus className="h-6 w-6 text-foreground" />

      <input
        ref={ setRef }
        type="file"
        accept={ accept }
        multiple={ multiple }
        className={ HIDDEN_FILE_INPUT_CLASS }
        name="image"
        onChange={ async( e ) => {
          if ( e.target.files ) {
            await onFiles( e.target.files );
            e.target.value = "";
          }
        } }
      />
    </div>
  );
} );
