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
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ConditionalGroup";
import ControlledColorInput
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledColorInput/ControlledColorInput";
import ControlledJsonInput
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledJsonInput";
import {
  ControlledAssetInput, ControlledAssetStackInput
} from "@/lib/assets";
import ControlledFormatSelect
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledFormatSelect/ControlledFormatSelect";
import ControlledSourceSelect
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledSourceSelect/ControlledSourceSelect";
import ControlledEasingInput
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledEasingInput/ControlledEasingInput";
import ControlledVector2DInput
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledVector2DInput/ControlledVector2DInput";
import ControlledSliderInput
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledSliderInput/ControlledSliderInput";
import ControlledWebcamDeviceSelect
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledWebcamDeviceSelect";
import ControlledAudioInputDeviceSelect
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledAudioInputDeviceSelect";
import ControlledMidiInputDeviceSelect
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledMidiInputDeviceSelect";
import ControlledJoypadDeviceSelect
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledJoypadDeviceSelect";
import CollapsibleItem from "@/components/CollapsibleItem";
import RandomizeSettingsButton from "@/components/RandomizeSettingsButton";
import BindingAffordance
  from "./ContentItems/components/BindingAffordance/BindingAffordance";
import {
  interactionBindingsEnabled
} from "@/lib/interactionBindings";
import deepClone from "@/utils/deepClone";
import type {
  FieldConfig
} from "./ContentItems/constants/field-config";
import {
  CONTROL_BAR_CLASS,
  CONTROL_BAR_INPUT_CLASS,
  CONTROL_CARD_CLASS,
  CONTROL_CARD_TEXTAREA_CLASS,
  CONTROL_CHEVRON_CLASS,
  CONTROL_RESET_BUTTON_CLASS
} from "./ContentItems/constants/control-bar";
import {
  BarLabelSegment, CardLabelHeader, ToggleSwitch
} from "./ContentItems/components/ControlChrome";
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

  // Capture the value the field was loaded with once on mount via a ref. We
  // clone it so a later in-place mutation of the form value can't drift our
  // baseline. Using getValues() is more reliable than formState.defaultValues,
  // which can behave unexpectedly through RHF's proxy — and, crucially, is not
  // kept in sync for dynamically inserted slides (duplicate).
  const initialValueRef = useRef<unknown>( undefined );
  const isInitializedRef = useRef( false );

  // Watch current value for display (slider) and modified detection
  const currentValue = useWatch( {
    control,
    name: registeredName
  } );

  if ( !isInitializedRef.current ) {
    isInitializedRef.current = true;
    initialValueRef.current = deepClone( getValues( registeredName ) );
  }

  const isModified =
    JSON.stringify( currentValue ) !== JSON.stringify( initialValueRef.current );

  // Reset restores the value the field was loaded with — exactly what
  // `isModified` compares against — so the reset indicator reliably clears.
  // We deliberately avoid resetField(), which resets to RHF's defaultValues:
  // those have no entry for a freshly duplicated slide, so resetField would
  // wipe the field to undefined and leave the reset icon stuck on.
  const handleReset = ( e: React.MouseEvent ) => {
    e.preventDefault();
    e.stopPropagation();
    setValue(
      registeredName,
      deepClone( initialValueRef.current ),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true
      }
    );
  };

  const {
    getExpanded, setExpanded
  } = useCollapsibleContext();

  const renderInput = () => {
    // Inline label shared by all one-line bar controls (label inside the bar
    // instead of an outer label row).
    const inlineLabel = !hideLabel ? config.label : undefined;

    switch ( config.component ) {
      case "checkbox":
        // Toggle switch: the visually-hidden checkbox keeps the RHF register
        // semantics, the two sibling spans render the track and the knob.
        return (
          <ToggleSwitch
            inputProps={ {
              id: registeredName,
              "aria-invalid": !!error,
              ...register( registeredName )
            } }
          />
        );

      case "number":
        return (
          <div className={ `${ CONTROL_BAR_CLASS } focus-within:ring-1 focus-within:ring-focus` }>
            <BarLabelSegment
              label={ inlineLabel }
              isModified={ isModified }
              onReset={ handleReset }
            />
            <input
              type="number"
              id={ registeredName }
              placeholder={ config.placeholder }
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
              className={ `${ CONTROL_BAR_INPUT_CLASS } text-right font-mono tabular-nums` }
            />
          </div>
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
          <div className={ CONTROL_CARD_CLASS }>
            <CardLabelHeader
              label={ inlineLabel }
              isModified={ isModified }
              onReset={ handleReset }
            />
            <textarea
              rows={ 4 }
              id={ registeredName }
              placeholder={ config.placeholder }
              aria-invalid={ !!error }
              { ...register( registeredName ) }
              className={ CONTROL_CARD_TEXTAREA_CLASS }
            />
          </div>
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
            <BarLabelSegment
              label={ inlineLabel }
              isModified={ isModified }
              onReset={ handleReset }
            />

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
          <div className={ CONTROL_CARD_CLASS }>
            <CardLabelHeader
              label={ inlineLabel }
              isModified={ isModified }
              onReset={ handleReset }
            />
            <div className="flex flex-col divide-y divide-theme/60">
              {config.options.map( ( option ) => {
                const value = String( option.value );
                const checked = selected.includes( value );

                return (
                  <label
                    key={ value }
                    className="flex min-h-[2.5rem] md:min-h-0 cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 md:py-1 select-none transition-colors hover:bg-hover/50"
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
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
                      className="block h-4 w-4 md:h-3.5 md:w-3.5 shrink-0 accent-foreground"
                    />
                  </label>
                );
              } )}
            </div>
          </div>
        );
      }

      case "format":
        return (
          <ControlledFormatSelect
            id={ registeredName }
            label={ inlineLabel }
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
                className="text-gray-500 cursor-pointer select-none flex items-center justify-between w-full min-h-[2.5rem] md:min-h-0"
                title="Click to expand/collapse"
              >
                <div className="flex min-w-0 items-center gap-1">
                  <ChevronDown
                    className="w-4 h-4 md:w-3 md:h-3 shrink-0 transition-transform"
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
                  className="flex items-center gap-0.5"
                  onClick={ ( e ) => e.stopPropagation() }
                >
                  {isModified && (
                    <button
                      type="button"
                      onClick={ handleReset }
                      tabIndex={ -1 }
                      title="Reset to saved value"
                      className="p-2 md:p-0.5 hover:bg-theme/20 rounded-md transition-colors"
                    >
                      <RotateCcw className="w-4 h-4 md:w-3.5 md:h-3.5" />
                    </button>
                  )}
                  <RandomizeSettingsButton
                    config={ config.fields }
                    basePath={ registeredName }
                    className="text-foreground p-2 md:p-0.5 hover:bg-theme/20 rounded-md transition-colors"
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

      case "webcam-device-select":
        return (
          <ControlledWebcamDeviceSelect
            name={ registeredName }
            label={ inlineLabel }
            isModified={ isModified }
            onReset={ handleReset }
          />
        );

      case "audio-input-device-select":
        return (
          <ControlledAudioInputDeviceSelect
            name={ registeredName }
            label={ inlineLabel }
            isModified={ isModified }
            onReset={ handleReset }
          />
        );

      case "midi-input-device-select":
        return (
          <ControlledMidiInputDeviceSelect
            name={ registeredName }
            label={ inlineLabel }
            isModified={ isModified }
            onReset={ handleReset }
          />
        );

      case "joypad-device-select":
        return (
          <ControlledJoypadDeviceSelect
            name={ registeredName }
            label={ inlineLabel }
            isModified={ isModified }
            onReset={ handleReset }
          />
        );

      case "asset-stack":
        return <ControlledAssetStackInput name={ registeredName } kind={ config.kind } />;

      case "hidden":
        return <input type="hidden" { ...register( registeredName ) } />;

      case "json":
        return (
          <ControlledJsonInput
            config={ config }
            name={ registeredName }
            label={ inlineLabel }
            isModified={ isModified }
            onReset={ handleReset }
            textareaClassName={ `${ CONTROL_CARD_TEXTAREA_CLASS } font-mono` }
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

      case "source-select":
        return (
          <ControlledSourceSelect
            name={ registeredName }
            label={ inlineLabel }
            isModified={ isModified }
            onReset={ handleReset }
          />
        );

      default:
        return (
          <div className={ `${ CONTROL_BAR_CLASS } focus-within:ring-1 focus-within:ring-focus` }>
            <BarLabelSegment
              label={ inlineLabel }
              isModified={ isModified }
              onReset={ handleReset }
            />
            <input
              type="text"
              id={ registeredName }
              placeholder={ config.placeholder }
              aria-invalid={ !!error }
              { ...register( registeredName ) }
              className={ CONTROL_BAR_INPUT_CLASS }
            />
          </div>
        );
    }
  };

  // Checkbox: label and switch share a single row — denser, and the whole
  // row is a finger-sized tap target. The reset button lives outside the
  // <label> elements so its clicks never race the label→checkbox activation.
  if ( config.component === "checkbox" ) {
    return (
      <div className="text-sm md:text-xs">
        <div className="flex min-h-[2.5rem] md:min-h-0 items-center justify-between gap-2 py-1 md:py-0.5">
          {config.label && !hideLabel && (
            <label
              htmlFor={ registeredName }
              className={ clsx(
                "min-w-0 flex-1 cursor-pointer select-none truncate",
                isModified ? "font-medium" : "text-gray-400"
              ) }
            >
              {config.label}
            </label>
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

            <label htmlFor={ registeredName } className="cursor-pointer">
              {renderInput()}
            </label>
          </span>
        </div>

        {error && (
          <p className="text-red-500 mt-1">{error.message?.toString()}</p>
        )}
      </div>
    );
  }

  // Components whose label can't live inside the control itself: the 2D pad
  // and the asset pickers keep the classic label row above. Everything else
  // renders its label inline (bar segment or card header).
  const needsOuterLabel =
    config.component === "vector2d" ||
    config.component === "image" ||
    config.component === "images-stack" ||
    config.component === "asset" ||
    config.component === "asset-stack";

  // Interactive-binding affordance: slider/number get it inline (beside the
  // bar); the vector2d pad gets it in its outer label row. The affordance
  // hides itself for non-sketch fields.
  const inlineBinding =
    config.component === "slider" || config.component === "number";
  // Gated by the interaction-bindings plugin so a field doesn't even mount the
  // affordance (and its per-field useWatch) when the feature is off.
  const bindable =
    ( inlineBinding || config.component === "vector2d" ) &&
    interactionBindingsEnabled();
  const bindingAffordance = bindable ? (
    <BindingAffordance
      fieldPath={ registeredName }
      component={ config.component }
      config={ config }
    />
  ) : null;

  return (
    <div className="text-sm md:text-xs">
      {needsOuterLabel &&
        config.label &&
        !hideLabel && (
        <div className="flex min-w-0 items-center justify-between gap-1">
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
          {config.component === "vector2d" && bindingAffordance}
        </div>
      )}

      {inlineBinding ? (
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">{renderInput()}</div>
          {bindingAffordance}
        </div>
      ) : (
        renderInput()
      )}

      {/* Display validation errors */}
      {error && (
        <p className="text-red-500 mt-1">{error.message?.toString()}</p>
      )}
    </div>
  );
}
