import React, {
  useRef
} from "react";

type DropZoneButtonProps = {
  onFiles: ( files: FileList ) => void | Promise<void>;
  label?: string;
  multiple?: boolean;
  className?: string;
  capture?: "environment" | "user";
  accept?: string;
};

export default function DropZoneButton( {
  onFiles,
  label = "Add image(s)",
  multiple = false,
  className = "",
  capture = "environment",
  accept = "image/*",
}: DropZoneButtonProps ) {
  const inputRef = useRef<HTMLInputElement>( null );

  return (
    <div
      className={`border border-dashed border-gray-300 rounded-md p-3 flex flex-col items-center justify-center gap-2 text-gray-500 bg-white ${ className }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={( e ) => e.preventDefault()}
      onDrop={async( e ) => {
        e.preventDefault();
        if ( e.dataTransfer.files?.length ) await onFiles( e.dataTransfer.files );
      }}
      role="button"
      tabIndex={0}
    >
      <span className="text-xs">{label}</span>
      <button
        type="button"
        onClick={( e ) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        className="inline-flex items-center gap-1 text-sm p-1 border rounded-sm bg-gray-100 hover:bg-gray-200"
      >
        Upload
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        multiple={multiple}
        className="hidden"
        onChange={async( e ) => {
          if ( e.target.files ) {
            await onFiles( e.target.files );
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
