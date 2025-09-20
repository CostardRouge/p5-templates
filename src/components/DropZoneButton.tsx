import React, {
  forwardRef,
  useRef
} from "react";
import {
  Plus
} from "lucide-react";

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
    accept = "image/*",
  }: DropZoneButtonProps, ref: React.Ref<HTMLDivElement>
) {
  const inputRef = useRef<HTMLInputElement>( null );

  return (
    <div
      ref={ref}
      className={`border border-dashed border-gray-300 rounded-sm p-3 flex flex-col items-center justify-center gap-2 text-gray-500 bg-white ${ className }`}
      onClick={( e ) => {
        e.stopPropagation();
        inputRef.current?.click();
      }}
      onDragOver={( e ) => e.preventDefault()}
      onDrop={async( e ) => {
        e.preventDefault();

        if ( e.dataTransfer.files?.length ) {
          await onFiles( e.dataTransfer.files );
        }
      }}
      role="button"
      tabIndex={0}
    >
      <Plus className="h-6 w-6 text-gray-400" />

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        name="image"
        onChange={async( e ) => {
          if ( e.target.files ) {
            await onFiles( e.target.files );
            e.target.value = "";
          }
        }}
      />
    </div>
  );
} );
