import {
  ChevronDown, RotateCcw
} from "lucide-react";
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
import CollapsibleItem from "@/components/CollapsibleItem";
import RandomizeSettingsButton from "@/components/RandomizeSettingsButton";
import type {
  FieldConfig
} from "./ContentItems/constants/field-config";
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
    // Bigger height/padding on mobile (<md), original sizing on desktop (md+).
    // Keeps desktop visually identical to before, gives mobile real touch targets.
    const baseInputClassName =
      "w-full border border-theme rounded-lg bg-background text-foreground "
      + "h-10 px-2 text-sm md:h-auto md:p-1 md:text-xs";

    const commonInputProps = {
      id: registeredName,
      placeholder: config.placeholder,
      className: baseInputClassName,
      "aria-invalid": !!error
    };

    switch ( config.component ) {
      case "checkbox":
        return (
          <input
            type="checkbox"
            id={ registeredName }
            aria-invalid={ !!error }
            { ...register( registeredName ) }
            // `switch-touch` is scoped via @media to mobile only; on desktop
            // the browser renders a native checkbox so the existing panel
            // layout stays visually unchanged.
            className="switch-touch md:w-fit md:p-1 md:border md:border-theme md:rounded-lg md:bg-background"
          />
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

      case "slider": {
        const displayValue = currentValue != null
          ? Number( currentValue ).toFixed( config.step && config.step < 1 ? 2 : 0 )
          : ( config.min ?? 0 );

        const handleNumberChange = ( e: React.ChangeEvent<HTMLInputElement> ) => {
          const parsed = config.step && config.step < 1
            ? parseFloat( e.target.value )
            : parseInt(
              e.target.value,
              10
            );

          if ( !isNaN( parsed ) ) {
            const clamped =
              config.min !== undefined && config.max !== undefined
                ? Math.min(
                  config.max,
                  Math.max(
                    config.min,
                    parsed
                  )
                )
                : parsed;

            setValue(
              registeredName,
              clamped,
              {
                shouldDirty: true
              }
            );
          }
        };

        return (
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <input
              type="range"
              id={ registeredName }
              aria-invalid={ !!error }
              { ...register(
                registeredName,
                {
                  valueAsNumber: true
                }
              ) }
              step={ config.step }
              min={ config.min }
              max={ config.max }
              className="slider-touch w-full md:p-1 md:border md:border-theme md:rounded-lg md:bg-background"
            />
            <input
              type="number"
              aria-label={ `${ config.label ?? registeredName } value` }
              className="text-sm md:text-xs font-mono bg-theme/20 px-2 py-1 md:py-0.5 rounded-md md:rounded w-20 md:w-14 text-center border border-theme/30 focus:outline-none focus:ring-1 focus:ring-theme self-end md:self-auto"
              value={ displayValue }
              step={ config.step }
              min={ config.min }
              max={ config.max }
              onChange={ handleNumberChange }
            />
          </div>
        );
      }

      case "textarea":
        return (
          <textarea
            rows={ 4 }
            { ...commonInputProps }
            className={ `${ baseInputClassName } h-auto py-2 md:py-1` }
            { ...register( registeredName ) }
          />
        );

      case "select":
        return (
          <select
            { ...commonInputProps }
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
        );

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
                  className="flex items-center gap-2 select-none"
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
                    className="block w-fit"
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
                className="text-gray-500 cursor-pointer select-none flex items-center justify-between w-full min-h-[36px] md:min-h-0 py-1 md:py-0"
                title="Click to expand/collapse"
              >
                <div className="flex items-center gap-1.5 md:gap-1">
                  <ChevronDown
                    className="w-4 h-4 md:w-3 md:h-3 transition-transform"
                    style={ {
                      transform: expanded ? "rotate(0deg)" : "rotate(-90deg)"
                    } }
                  />
                  <span className={ isModified ? "font-medium text-foreground" : undefined }>
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
                        aria-label="Reset to saved value"
                        className="h-7 w-7 md:h-auto md:w-auto inline-flex items-center justify-center hover:bg-theme/20 rounded transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <span className="leading-none select-none hidden md:inline">·</span>
                    </>
                  )}
                  <RandomizeSettingsButton
                    config={ config.fields }
                    basePath={ registeredName }
                    className="h-7 w-7 md:h-auto md:w-auto inline-flex items-center justify-center hover:bg-theme/20 rounded transition-colors"
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
        return <ControlledColorInput name={ registeredName } />;

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
        return <ControlledEasingInput name={ registeredName } />;

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

  return (
    <div className="text-sm md:text-xs">
      {/* Don't show a label for groups, as they have their own internal labels */}
      {config.component !== "nested-object" &&
        config.component !== "conditional-group" &&
        config.component !== "item-list" &&
        config.component !== "hidden" &&
        config.label &&
        !hideLabel && (
        <div className="flex items-center justify-between gap-1 mb-1 md:mb-0">
          <label
            htmlFor={ registeredName }
            className={ `select-none ${
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
              aria-label="Reset to saved value"
              className="h-7 w-7 md:h-auto md:w-auto inline-flex items-center justify-center text-gray-400 hover:text-foreground hover:bg-foreground/10 rounded-md transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
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
