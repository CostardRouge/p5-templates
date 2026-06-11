import {
  ChevronDown, RotateCcw
} from "lucide-react";
import clsx from "clsx";
import {
  useRef
} from "react";
import {
  get, useFormContext, useWatch
} from "react-hook-form";
import ConditionalGroup
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ConditionalGroup";
import ControlledColorInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledColorInput/ControlledColorInput";
import ControlledJsonInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledJsonInput";
import {
  ControlledAssetInput, ControlledAssetStackInput
} from "@/lib/assets";
import ControlledSizePresetSelect
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledSizePresetSelect/ControlledSizePresetSelect";
import ControlledEasingInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledEasingInput/ControlledEasingInput";
import ControlledVector2DInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledVector2DInput/ControlledVector2DInput";
import ControlledSliderInput
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/ControlledSliderInput/ControlledSliderInput";
import CollapsibleItem from "@/components/CollapsibleItem";
import RandomizeSettingsButton from "@/components/RandomizeSettingsButton";
import type {
  FieldConfig
} from "./ContentItems/constants/field-config";
import {
  CONTROL_BAR_CLASS,
  CONTROL_CHEVRON_CLASS,
  CONTROL_LABEL_SEGMENT_CLASS,
  CONTROL_RESET_BUTTON_CLASS
} from "./ContentItems/constants/control-bar";
import ItemListRenderer from "./ItemListRenderer";
import {
  useCollapsibleContext
} from "../hooks/useCollapsibleStates";
import {
  getSharedCollapsibleKey
} from "../utils/getSharedCollapsibleKey";

type FieldRendererProps = {
  fieldBasePath: string;
  fieldName: string;
  config: FieldConfig;
  hideLabel?: boolean;
};

export default function FieldRenderer( {
  fieldBasePath,
  fieldName,
  config,
  hideLabel = false
}: FieldRendererProps ) {
  const {
    register,
    setValue,
    resetField,
    getValues,
    formState: {
      errors
    },
    control
  } = useFormContext();

  const registeredName = fieldName
    ? `${ fieldBasePath }.${ fieldName }`
    : fieldBasePath;

  const error = get(
    errors,
    registeredName
  );

  // Capture the initial (DB-loaded) value once on mount via a ref.
  // Using getValues() is more reliable than formState.defaultValues
  // which can behave unexpectedly through RHF's proxy.
  const initialValueRef = useRef<unknown>( undefined );
  const isInitializedRef = useRef( false );

  // Watch current value for display (slider) and modified detection
  const currentValue = useWatch( {
    control,
    name: registeredName
  } );

  if ( !isInitializedRef.current ) {
    isInitializedRef.current = true;
    initialValueRef.current = getValues( registeredName );
  }

  const isModified =
    JSON.stringify( currentValue ) !== JSON.stringify( initialValueRef.current );

  const handleReset = ( e: React.MouseEvent ) => {
    e.preventDefault();
    e.stopPropagation();
    resetField( registeredName );
  };

  const {
    getExpanded, setExpanded
  } = useCollapsibleContext();

  const renderInput = () => {
    const commonInputProps = {
      id: registeredName,
      placeholder: config.placeholder,
      // 16px font on mobile prevents iOS from zooming into focused inputs;
      // taller padding gives finger-sized targets, back to compact on md+.
      className: "w-full px-2.5 py-2 md:px-1.5 md:py-1 border border-theme rounded-lg bg-background text-foreground text-base md:text-xs",
      "aria-invalid": !!error
    };

    switch ( config.component ) {
      case "checkbox":
        // Toggle switch: the visually-hidden checkbox keeps the RHF register
        // semantics, the two sibling spans render the track and the knob.
        return (
          <span className="relative inline-flex shrink-0 items-center">
            <input
              type="checkbox"
              id={ registeredName }
              aria-invalid={ !!error }
              { ...register( registeredName ) }
              className="peer sr-only"
            />
            <span className="h-6 w-10 md:h-5 md:w-9 rounded-full border border-theme bg-foreground/10 transition-colors peer-checked:bg-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-focus/50" />
            <span className="pointer-events-none absolute left-0.5 top-1/2 h-5 w-5 md:h-4 md:w-4 -translate-y-1/2 rounded-full border border-theme bg-background shadow transition-transform peer-checked:translate-x-4" />
          </span>
        );

      case "number":
        return (
          <input
            type="number"
            { ...commonInputProps }
            { ...register(
              registeredName,
              {
                valueAsNumber: true
              }
            ) }
            step={ config.step }
            min={ config.min }
            max={ config.max }
          />
        );

      case "slider":
        // Full-bar slider with the label rendered inside the control, so it
        // doesn't need the outer label row (skipped in the wrapper below).
        return (
          <ControlledSliderInput
            name={ registeredName }
            label={ config.label ?? fieldName }
            min={ config.min }
            max={ config.max }
            step={ config.step }
            isModified={ isModified }
            onReset={ handleReset }
          />
        );

      case "textarea":
        return (
          <textarea
            rows={ 4 }
            { ...commonInputProps }
            { ...register( registeredName ) }
          />
        );

      case "select": {
        // Segmented one-liner sharing the slider bar chrome: label segment on
        // the left, current value + chevron on the right. The invisible
        // native <select> covers the whole bar so any tap opens the platform
        // picker.
        const selectedOption = config.options.find( ( option ) => String( option.value ) === String( currentValue ?? "" ) );
        const selectedLabel =
          selectedOption?.label ?? ( config.noneLabel || "--" );

        return (
          <div className={ CONTROL_BAR_CLASS }>
            {config.label && !hideLabel && (
              <span className={ CONTROL_LABEL_SEGMENT_CLASS }>
                <span
                  className={ clsx(
                    "truncate",
                    isModified ? "font-medium text-foreground" : "text-label"
                  ) }
                >
                  {config.label}
                </span>
                {isModified && (
                  <button
                    type="button"
                    tabIndex={ -1 }
                    title="Reset to saved value"
                    onClick={ handleReset }
                    className={ `relative z-10 shrink-0 ${ CONTROL_RESET_BUTTON_CLASS }` }
                  >
                    <RotateCcw className="h-3.5 w-3.5 md:h-3 md:w-3" />
                  </button>
                )}
              </span>
            )}

            <span className="pointer-events-none flex min-w-0 flex-1 items-center justify-between gap-1 px-2.5">
              <span className="truncate">{selectedLabel}</span>
              <ChevronDown className={ CONTROL_CHEVRON_CLASS } />
            </span>

            <select
              id={ registeredName }
              aria-label={ config.label ?? registeredName }
              aria-invalid={ !!error }
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              { ...register(
                registeredName,
                {
                  setValueAs: config.asNumber
                    ? ( value: unknown ) =>
                      value === "" || value == null ? undefined : Number( value )
                    : undefined
                }
              ) }
            >
              {config.noneLabel ? (
                <option value="">{config.noneLabel || "--"}</option>
              ) : null}

              {config.options.map( ( option ) => (
                <option key={ option.value } value={ option.value }>
                  {option.label}
                </option>
              ) )}
            </select>
          </div>
        );
      }

      case "multi-select": {
        const selected: string[] = Array.isArray( currentValue )
          ? ( currentValue as string[] )
          : [];

        return (
          <div className="flex flex-col gap-1">
            {config.options.map( ( option ) => {
              const value = String( option.value );
              const checked = selected.includes( value );

              return (
                <label
                  key={ value }
                  className="flex min-h-[2.25rem] md:min-h-0 cursor-pointer items-center gap-2 py-1 md:py-0.5 select-none"
                >
                  <input
                    type="checkbox"
                    checked={ checked }
                    onChange={ ( e ) => {
                      const next = e.target.checked
                        ? [
                          ...selected,
                          value
                        ]
                        : selected.filter( ( v ) => v !== value );

                      setValue(
                        registeredName,
                        next,
                        {
                          shouldDirty: true
                        }
                      );
                    } }
                    className="block h-4 w-4 md:h-3.5 md:w-3.5 accent-foreground"
                  />
                  <span>{option.label}</span>
                </label>
              );
            } )}
          </div>
        );
      }

      case "size-preset":
        return (
          <ControlledSizePresetSelect
            className="p-1"
            id={ registeredName }
            options={ config.options }
            sizeFieldPrefix={ fieldBasePath ? `${ fieldBasePath }.` : "" }
          />
        );

      case "nested-object": {
        const collapsibleKey = `nested-${ getSharedCollapsibleKey( registeredName ) }`;
        const expanded = getExpanded(
          collapsibleKey,
          config.initialExpanded ?? false
        );

        return (
          <CollapsibleItem
            expanded={ expanded }
            onToggle={ ( isExpanded ) => setExpanded(
              collapsibleKey,
              isExpanded
            ) }
            header={ ( expanded ) => (
              <div
                className="text-gray-500 cursor-pointer select-none flex items-center justify-between w-full"
                title="Click to expand/collapse"
              >
                <div className="flex min-w-0 items-center gap-1">
                  <ChevronDown
                    className="w-3 h-3 shrink-0 transition-transform"
                    style={ {
                      transform: expanded ? "rotate(0deg)" : "rotate(-90deg)"
                    } }
                  />
                  <span
                    className={ clsx(
                      "truncate",
                      isModified && "font-medium text-foreground"
                    ) }
                  >
                    {config.label}
                  </span>
                </div>
                <div
                  className="flex items-center gap-1.5"
                  onClick={ ( e ) => e.stopPropagation() }
                >
                  {isModified && (
                    <>
                      <button
                        type="button"
                        onClick={ handleReset }
                        tabIndex={ -1 }
                        title="Reset to saved value"
                        className="hover:bg-theme/20 rounded transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <span className="leading-none select-none">·</span>
                    </>
                  )}
                  <RandomizeSettingsButton
                    config={ config.fields }
                    basePath={ registeredName }
                    className="hover:bg-theme/20 rounded transition-colors"
                  />
                </div>
              </div>
            ) }
          >
            <div className="p-1 border border-theme rounded-xl space-y-1 bg-background/50 ml-2">
              {Object.entries( config.fields ).map( ( [
                subFieldName,
                subConfig
              ] ) => (
                <FieldRenderer
                  key={ subFieldName }
                  fieldBasePath={ registeredName }
                  fieldName={ subFieldName }
                  config={ subConfig }
                />
              ) )}
            </div>
          </CollapsibleItem>
        );
      }

      case "conditional-group": {
        return (
          <ConditionalGroup
            basePath={ registeredName }
            selectClassName={ commonInputProps.className }
            config={ config }
          />
        );
      }

      case "color":
        return (
          <ControlledColorInput
            name={ registeredName }
            label={ config.label ?? fieldName }
            isModified={ isModified }
            onReset={ handleReset }
          />
        );

      case "image":
        return <ControlledAssetInput name={ registeredName } kind="images" />;

      case "images-stack":
        return <ControlledAssetStackInput name={ registeredName } kind="images" />;

      case "asset":
        return <ControlledAssetInput name={ registeredName } kind={ config.kind } />;

      case "asset-stack":
        return <ControlledAssetStackInput name={ registeredName } kind={ config.kind } />;

      case "hidden":
        return <input type="hidden" { ...register( registeredName ) } />;

      case "json":
        return (
          <ControlledJsonInput
            config={ config }
            name={ registeredName }
            textareaClassName={ commonInputProps.className }
          />
        );

      case "item-list":
        return <ItemListRenderer name={ registeredName } config={ config } />;

      case "easing":
        return (
          <ControlledEasingInput
            name={ registeredName }
            label={ config.label ?? fieldName }
            isModified={ isModified }
            onReset={ handleReset }
          />
        );

      case "vector2d":
        return (
          <ControlledVector2DInput
            name={ registeredName }
            config={ config }
          />
        );

      default:
        return (
          <input
            type="text"
            { ...commonInputProps }
            { ...register( registeredName ) }
          />
        );
    }
  };

  // Checkbox: label and switch share a single row — denser, and the whole
  // row is a finger-sized tap target.
  if ( config.component === "checkbox" ) {
    return (
      <div className="text-sm md:text-xs">
        <label
          htmlFor={ registeredName }
          className="flex min-h-[2.5rem] md:min-h-0 cursor-pointer select-none items-center justify-between gap-2 py-1 md:py-0.5"
        >
          {config.label && !hideLabel && (
            <span
              className={ clsx(
                "min-w-0 truncate",
                isModified ? "font-medium" : "text-gray-400"
              ) }
            >
              {config.label}
            </span>
          )}

          <span className="flex shrink-0 items-center gap-1">
            {isModified && (
              <button
                type="button"
                onClick={ handleReset }
                tabIndex={ -1 }
                title="Reset to saved value"
                className={ CONTROL_RESET_BUTTON_CLASS }
              >
                <RotateCcw className="h-3.5 w-3.5 md:h-3 md:w-3" />
              </button>
            )}

            {renderInput()}
          </span>
        </label>

        {error && (
          <p className="text-red-500 mt-1">{error.message?.toString()}</p>
        )}
      </div>
    );
  }

  return (
    <div className="text-sm md:text-xs">
      {/* Don't show a label for groups (they have their own internal labels)
          or one-line bar controls (slider, select, color, easing render the
          label inside the bar) */}
      {config.component !== "nested-object" &&
        config.component !== "conditional-group" &&
        config.component !== "item-list" &&
        config.component !== "hidden" &&
        config.component !== "slider" &&
        config.component !== "select" &&
        config.component !== "color" &&
        config.component !== "easing" &&
        config.label &&
        !hideLabel && (
        <div className="flex min-w-0 items-center gap-1">
          <label
            htmlFor={ registeredName }
            className={ `select-none truncate ${
              isModified
                ? "font-medium"
                : "text-gray-400"
            }` }
          >
            {config.label}
          </label>
          {isModified && (
            <button
              type="button"
              onClick={ handleReset }
              tabIndex={ -1 }
              title="Reset to saved value"
              className={ `shrink-0 ${ CONTROL_RESET_BUTTON_CLASS }` }
            >
              <RotateCcw className="h-3.5 w-3.5 md:h-3 md:w-3" />
            </button>
          )}
        </div>
      )}

      {renderInput()}

      {/* Display validation errors */}
      {error && (
        <p className="text-red-500 mt-1">{error.message?.toString()}</p>
      )}
    </div>
  );
}
