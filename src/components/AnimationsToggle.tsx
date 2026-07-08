"use client";

interface AnimationsToggleProps {
  enabled: boolean;
  onChange: ( value: boolean ) => void;
  disabled?: boolean;
}

/**
 * iOS-style switch for toggling animated previews on the sketches page.
 */
export default function AnimationsToggle( {
  enabled,
  onChange,
  disabled = false
}: AnimationsToggleProps ) {
  return (
    <label
      className={ `inline-flex items-center gap-2 select-none ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }` }
      title={ enabled ? "Disable animated previews" : "Enable animated previews" }
    >
      <span className="text-xs sm:text-sm text-foreground/70 font-medium">
        Live previews
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={ enabled }
        aria-label="Toggle animated previews"
        disabled={ disabled }
        onClick={ () => onChange( !enabled ) }
        className={ `relative inline-flex h-5 w-9 sm:h-6 sm:w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-foreground/20 ${
          enabled ? "bg-foreground" : "bg-border"
        }` }
      >
        <span
          className={ `inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-background shadow-sm transition-transform duration-200 ${
            enabled ? "translate-x-[18px] sm:translate-x-[22px]" : "translate-x-0.5"
          }` }
        />
      </button>
    </label>
  );
}
