import {
  Menu, MenuButton, MenuItem, MenuItems
} from "@headlessui/react";
import {
  Clapperboard,
  Copy,
  Download,
  Eye,
  FileUp,
  Link,
  Menu as MenuIcon,
  RotateCcw,
  Trash2,
  X
} from "lucide-react";
import HardLink from "@/components/HardLink";
import fetchDownload from "@/utils/fetchDownload";
import DownloadMenuItems from "./DownloadMenuItems";
import type {
  JobModel
} from "@/types/recording.types";
import React, {
  useRef
} from "react";
import Toast from "@/components/Toast";

interface ActionsMenuProps {
  job: JobModel;
  onCancel?: ( job: JobModel ) => void;
  onDelete?: ( job: JobModel ) => void;
  onStart?: ( job: JobModel ) => void;
  onRetry?: ( job: JobModel ) => void;
  onPreviewModal?: () => void;
  onClone?: ( job: JobModel ) => void;
}

export default function ActionsMenu( {
  job,
  onCancel,
  onDelete,
  onStart,
  onRetry,
  onPreviewModal,
  onClone
}: ActionsMenuProps ) {
  const fileInputRef = useRef<HTMLInputElement>( null );

  const handleAction = async(
    action: string,
    endpoint: string,
    method: string = "POST",
    confirmMessage?: string
  ) => {
    if ( confirmMessage && !confirm( confirmMessage ) ) {
      return;
    }

    try {
      const response = await fetch(
        endpoint,
        {
          method
        }
      );

      if ( !response.ok ) {
        throw new Error( `${ action } failed` );
      }

      const result = await response.json();
      const success =
        result.cancelled || result.deleted || result.retried || result.started;

      if ( success ) {
        if ( action === "cancel" ) {
          onCancel?.( job );
        } else if ( action === "delete" ) {
          onDelete?.( job );
        } else if ( action === "retry" ) {
          onRetry?.( job );
        } else if ( action === "start" ) {
          onStart?.( job );
        }
      } else {
        alert( `Could not ${ action } job: ${ job.id.slice(
          0,
          8
        ) }` );
      }
    } catch ( error ) {
      alert( `Failed to ${ action }. Please try again.` );
    }
  };

  const [
    importToast,
    setImportToast
  ] = React.useState<{
    message: string;
    type: "success" | "error";
  } | null>( null );

  const handleImportOptions = async( file: File ) => {
    try {
      const formData = new FormData();

      formData.append(
        "file",
        file
      );

      const response = await fetch(
        `/api/options/import/${ job.id }`,
        {
          method: "POST",
          body: formData
        }
      );

      if ( !response.ok ) {
        const error = await response.json();

        throw new Error( error.error || "Import failed" );
      }

      const result = await response.json();

      if ( result.success ) {
        setImportToast( {
          message: "Options imported successfully",
          type: "success"
        } );
        // Reload after showing toast
        setTimeout(
          () => {
            window.location.reload();
          },
          1000
        );
      } else {
        throw new Error( "Failed to import options" );
      }
    } catch ( error ) {
      setImportToast( {
        message:
          error instanceof Error ? error.message : "Failed to import options",
        type: "error"
      } );
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = ( event: React.ChangeEvent<HTMLInputElement> ) => {
    const file = event.target.files?.[ 0 ];

    if ( file ) {
      handleImportOptions( file );
      // Reset input so same file can be selected again
      event.target.value = "";
    }
  };

  return (
    <>
      <Menu as="div" className="relative inline-block text-left">
        <MenuButton className="p-2 bg-background/90 backdrop-blur-sm hover:bg-hover rounded-lg border border-border shadow-lg transition-colors inline-flex items-center justify-center">
          <MenuIcon className="h-4 w-4 text-foreground" />
        </MenuButton>

        <MenuItems
          anchor="bottom end"
          className="z-50 w-64 border border-border rounded-xl bg-background shadow-xl overflow-hidden mt-2 focus:outline-none [--anchor-gap:0.5rem] [--anchor-padding:0.5rem]"
        >
          {/* Preview Section */}
          {job.status === "completed" && job.videoUrls && (
            <>
              <div className="px-3 py-2 bg-hover/30">
                <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                  View
                </p>
              </div>
              <MenuItem>
                {( {
                  focus
                } ) => (
                  <button
                    onClick={onPreviewModal}
                    className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
                  >
                    <Eye className="h-4 w-4 text-foreground/70" />
                    <span className="font-medium">Preview Video</span>
                  </button>
                )}
              </MenuItem>
              <div className="h-px bg-border" />
            </>
          )}

          {/* Navigation Section */}
          <div className="px-3 py-2 bg-hover/30">
            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
              Navigate
            </p>
          </div>
          <MenuItem>
            {( {
              focus
            } ) => (
              <HardLink
                href={`templates/${ job.template }?id=${ job.id }`}
                className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
              >
                <Link className="h-4 w-4 text-foreground/70" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">Open Recording</span>
                  <p className="text-xs text-foreground/50 font-mono truncate">
                    #{job.id.slice(
                      0,
                      8
                    )}
                  </p>
                </div>
              </HardLink>
            )}
          </MenuItem>
          <MenuItem>
            {( {
              focus
            } ) => (
              <HardLink
                href={`templates/${ job.template }`}
                className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
              >
                <Clapperboard className="h-4 w-4 text-foreground/70" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">Open Template</span>
                  <p className="text-xs text-foreground/50 truncate">
                    {job.template}
                  </p>
                </div>
              </HardLink>
            )}
          </MenuItem>

          {/* Download Section */}
          <div className="h-px bg-border" />
          <div className="px-3 py-2 bg-hover/30">
            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
              Download
            </p>
          </div>
          <DownloadMenuItems job={job} />
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={async() =>
                  await fetchDownload( `/api/options/download/${ job.id }` )
                }
                className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
              >
                <Download className="h-4 w-4 text-foreground/70" />
                <span className="font-medium">Options JSON</span>
              </button>
            )}
          </MenuItem>

          {/* Import Section - Only for draft, failed, cancelled */}
          {[
            "draft",
            "failed",
            "cancelled"
          ].includes( job.status ) && (
            <>
              <div className="h-px bg-border" />
              <div className="px-3 py-2 bg-hover/30">
                <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                  Import
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <MenuItem>
                {( {
                  focus
                } ) => (
                  <button
                    onClick={handleImportClick}
                    className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
                  >
                    <FileUp className="h-4 w-4 text-purple-600" />
                    <div className="flex-1 min-w-0 text-left">
                      <span className="font-medium text-purple-600">
                        Import Options JSON
                      </span>
                      <p className="text-xs text-foreground/50">
                        Assets will be ignored
                      </p>
                    </div>
                  </button>
                )}
              </MenuItem>
            </>
          )}

          {/* Action Section */}
          <div className="h-px bg-border" />
          <div className="px-3 py-2 bg-hover/30">
            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
              Actions
            </p>
          </div>

          {job.status === "draft" && (
            <MenuItem>
              {( {
                focus
              } ) => (
                <button
                  onClick={() =>
                    handleAction(
                      "start",
                      `/api/recordings/${ job.id }/start`
                    )
                  }
                  className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
                >
                  <Clapperboard className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-600">
                    Start Recording
                  </span>
                </button>
              )}
            </MenuItem>
          )}

          {[
            "queued",
            "active"
          ].includes( job.status ) && (
            <MenuItem>
              {( {
                focus
              } ) => (
                <button
                  onClick={() =>
                    handleAction(
                      "cancel",
                      `/api/recordings/${ job.id }/cancel`
                    )
                  }
                  className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
                >
                  <X className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-600">Cancel</span>
                </button>
              )}
            </MenuItem>
          )}

          {[
            "cancelled",
            "failed"
          ].includes( job.status ) && (
            <MenuItem>
              {( {
                focus
              } ) => (
                <button
                  onClick={() =>
                    handleAction(
                      "retry",
                      `/api/recordings/${ job.id }/retry`
                    )
                  }
                  className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
                >
                  <RotateCcw className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-600">
                    Retry Recording
                  </span>
                </button>
              )}
            </MenuItem>
          )}

          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={() => onClone?.( job )}
                className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
              >
                <Copy className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-purple-600">
                  Clone as Draft
                </span>
              </button>
            )}
          </MenuItem>

          {/* Delete Section */}
          {[
            "completed",
            "cancelled",
            "draft",
            "failed"
          ].includes( job.status ) && (
            <>
              <div className="h-px bg-border" />
              <MenuItem>
                {( {
                  focus
                } ) => (
                  <button
                    onClick={() =>
                      handleAction(
                        "delete",
                        `/api/recordings/${ job.id }`,
                        "DELETE",
                        `Delete this ${ job.status } recording? This action cannot be undone.`
                      )
                    }
                    className={`${ focus ? "bg-red-50 dark:bg-red-950/20" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-600">
                      Delete Recording
                    </span>
                  </button>
                )}
              </MenuItem>
            </>
          )}
        </MenuItems>
      </Menu>

      {importToast && (
        <Toast
          message={importToast.message}
          type={importToast.type}
          onClose={() => setImportToast( null )}
        />
      )}
    </>
  );
}
