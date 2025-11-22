import {
  Menu, MenuButton, MenuItem, MenuItems
} from "@headlessui/react";
import {
  AlertTriangle,
  Clapperboard,
  Copy,
  Download,
  Eye,
  Link,
  Menu as MenuIcon,
  RotateCcw,
  Trash2,
  X
} from "lucide-react";
import HardLink from "@/components/HardLink";
import fetchDownload from "@/components/utils/fetchDownload";
import DownloadMenuItems from "./DownloadMenuItems";
import type {
  JobModel
} from "@/types/recording.types";

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
  const isStale = [
    "active",
    "queued"
  ].includes( job.status ) &&
    ( Date.now() - new Date( job.updatedAt ).getTime() ) > 60 * 60 * 1000;

  const handleAction = async(
    action: string,
    endpoint: string,
    method: string = "POST",
    confirmMessage?: string
  ) => {
    if ( confirmMessage && !confirm( confirmMessage ) ) return;

    try {
      const response = await fetch(
        endpoint,
        {
          method
        }
      );

      if ( !response.ok ) throw new Error( `${ action } failed` );

      const result = await response.json();
      const success = result.cancelled || result.deleted || result.retried || result.started;

      if ( success ) {
        if ( action === "cancel" || action === "force-cancel" ) onCancel?.( job );
        else if ( action === "delete" ) onDelete?.( job );
        else if ( action === "retry" ) onRetry?.( job );
        else if ( action === "start" ) onStart?.( job );
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

  return (
    <Menu as="div" className="relative inline-block text-left">
      <MenuButton className="p-2 bg-background/90 backdrop-blur-sm hover:bg-hover rounded-lg border border-border shadow-lg transition-colors inline-flex items-center justify-center">
        <MenuIcon className="h-4 w-4 text-foreground"/>
      </MenuButton>

      <MenuItems
        anchor="bottom end"
        className="z-50 w-64 border border-border rounded-xl bg-background shadow-xl overflow-hidden mt-2 focus:outline-none [--anchor-gap:0.5rem] [--anchor-padding:0.5rem]"
      >
        {/* Preview Section */}
        {job.status === "completed" && job.videoUrls && (
          <>
            <div className="px-3 py-2 bg-hover/30">
              <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">View</p>
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
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Navigate</p>
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
                <p className="text-xs text-foreground/50 font-mono truncate">#{job.id.slice(
                  0,
                  8
                )}</p>
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
                <p className="text-xs text-foreground/50 truncate">{job.template}</p>
              </div>
            </HardLink>
          )}
        </MenuItem>

        {/* Download Section */}
        <div className="h-px bg-border" />
        <div className="px-3 py-2 bg-hover/30">
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Download</p>
        </div>
        <DownloadMenuItems job={job} />
        <MenuItem>
          {( {
            focus
          } ) => (
            <button
              onClick={async() => await fetchDownload( `/api/options/download/${ job.id }` )}
              className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
            >
              <Download className="h-4 w-4 text-foreground/70" />
              <span className="font-medium">Options JSON</span>
            </button>
          )}
        </MenuItem>

        {/* Action Section */}
        <div className="h-px bg-border" />
        <div className="px-3 py-2 bg-hover/30">
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Actions</p>
        </div>

        {job.status === "draft" && (
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={() => handleAction(
                  "start",
                  `/api/recordings/${ job.id }/start`
                )}
                className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
              >
                <Clapperboard className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-600">Start Recording</span>
              </button>
            )}
          </MenuItem>
        )}

        {job.status === "queued" && (
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={() => handleAction(
                  "cancel",
                  `/api/recordings/${ job.id }/cancel`
                )}
                className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
              >
                <X className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-orange-600">Cancel</span>
              </button>
            )}
          </MenuItem>
        )}

        {isStale && (
          <MenuItem>
            {( {
              focus
            } ) => (
              <button
                onClick={() => handleAction(
                  "force-cancel",
                  `/api/recordings/${ job.id }/force-cancel`,
                  "POST",
                  `Force cancel stale job ${ job.id.slice(
                    0,
                    8
                  ) }? This will mark it as cancelled.`
                )}
                className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
              >
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-orange-600">Force Cancel (Stale)</span>
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
                onClick={() => handleAction(
                  "retry",
                  `/api/recordings/${ job.id }/retry`
                )}
                className={`${ focus ? "bg-hover" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
              >
                <RotateCcw className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-600">Retry Recording</span>
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
              <span className="font-medium text-purple-600">Clone as Draft</span>
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
                  onClick={() => handleAction(
                    "delete",
                    `/api/recordings/${ job.id }`,
                    "DELETE",
                    `Delete this ${ job.status } recording? This action cannot be undone.`
                  )}
                  className={`${ focus ? "bg-red-50 dark:bg-red-950/20" : "" } flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors`}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-600">Delete Recording</span>
                </button>
              )}
            </MenuItem>
          </>
        )}
      </MenuItems>
    </Menu>
  );
}
