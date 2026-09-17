import {
  controlForChannel
} from "@/p5/utils/interaction/controllerMap.js";
import {
  getMidiPortName
} from "@/lib/channelBridge";
import {
  interactionBindingsEnabled
} from "@/lib/interactionBindings";
import type {
  FieldConfig
} from "../components/ContentItems/constants/field-config";
import type {
  Binding
} from "../components/ContentItems/components/BindingAffordance/bindingUtils";
import {
  bindingKindFor,
  getSketchScope,
  interactionEnablePaths,
  interactiveScopeFor,
  makeDefaultBinding,
  toSketchRelativePath
} from "../components/ContentItems/components/BindingAffordance/bindingUtils";

type GetValues = ( path?: string ) => any;
type SetValue = ( path: string, value: unknown, options?: Record<string, unknown> ) => void;

/**
 * Whether a field can host "learn a control" — the same conditions the
 * modulation pastille itself is gated on, so the menu entry never appears where
 * the affordance would not.
 *
 * A 2D pad is excluded: `observeForLearn` only ever returns a SCALAR channel,
 * so a vector2d target would arm and then wait forever. The binding popover
 * hides its own learn button for that kind, for that same reason.
 */
export function canLearnBindingFor(
  registeredName: string, config: FieldConfig
): boolean {
  const kind = bindingKindFor( config.component );

  return (
    interactionBindingsEnabled() &&
    getSketchScope( registeredName ) !== null &&
    kind !== null &&
    kind !== "vector2d"
  );
}

/**
 * Switch MIDI on, then let the caller start listening — in that order.
 *
 * Nothing about a learn works until `interaction.midi.enabled` is set: the
 * handler only requests MIDI access from that flag, so without it
 * `requestMIDIAccess()` is never even called, no CC channel is ever published,
 * and the observer has nothing to diff. Moving a knob does literally nothing.
 * The binding popover enables the same way before arming (`onArmLearn()` then
 * `learn.arm()`); this is that sequence, written once so a caller cannot get it
 * backwards.
 *
 * `midi.ccLast` stands in for every CC — a `midi.*` id asks for the same two
 * flags, there is no per-CC feature flag.
 */
export async function armLearnForField(
  getValues: GetValues,
  setValue: SetValue,
  registeredName: string
): Promise<void> {
  const scope = getSketchScope( registeredName );

  if ( !scope ) {
    return;
  }

  await enableSourceInputs(
    getValues,
    setValue,
    scope,
    interactiveScopeFor( scope ),
    "midi.ccLast"
  );
}

/**
 * Point a field at the channel that was just moved.
 *
 * Stores the ABSTRACT control (`knob.3`) whenever the connected port is known,
 * falling back to the raw channel id otherwise. That is what lets a learned
 * binding survive the user switching port on the same controller: a Launchkey's
 * knob 3 sends CC 80 on its MIDI port and CC 23 on its DAW port, and only the
 * abstract name is true on both. The engine resolves it every frame
 * (`options.js`, `withResolvedControls`).
 *
 * On a field that is ALREADY bound, only the source is replaced — the range,
 * curve and smoothing the user set are kept, because the gesture means "drive
 * this from another knob", not "start over".
 */
export async function applyLearnedChannel(
  getValues: GetValues,
  setValue: SetValue,
  registeredName: string,
  config: FieldConfig,
  channelId: string
): Promise<void> {
  const scope = getSketchScope( registeredName );
  const target = toSketchRelativePath( registeredName );
  const kind = bindingKindFor( config.component );

  if ( !scope || !target || !kind ) {
    return;
  }

  const interactiveScope = interactiveScopeFor( scope );
  const bindingsPath = `${ interactiveScope }.bindings`;
  const existing: Binding[] = getValues( bindingsPath ) ?? [];

  // An abstract control when this port is mapped, the raw channel otherwise.
  // Both are honoured by the resolver; only the first is portable.
  const control = controlForChannel(
    getMidiPortName(),
    channelId
  );
  const pointer = control
    ? {
      control,
      source: channelId
    }
    : {
      control: undefined,
      source: channelId
    };

  const index = existing.findIndex( ( binding ) => binding?.target === target );

  const next = index >= 0
    ? existing.map( (
      binding, at
    ) => ( at === index
      ? {
        ...binding,
        ...pointer
      }
      : binding ) )
    : [
      ...existing,
      {
        ...makeDefaultBinding(
          target,
          kind,
          config,
          getValues( registeredName )
        ),
        ...pointer
      }
    ];

  setValue(
    bindingsPath,
    next,
    {
      shouldDirty: true
    }
  );

  await enableSourceInputs(
    getValues,
    setValue,
    scope,
    interactiveScope,
    channelId
  );
}

/**
 * Switch on whatever the channel needs to produce a value.
 *
 * `sampleChannels` publishes no MIDI channel unless `interaction.midi.enabled`
 * is set, and the handler only requests MIDI access from that same flag — so a
 * binding pointing at a knob does nothing until this runs. A sketch that
 * declares its own interaction block owns it; otherwise the managed one under
 * `interactive` is seeded, exactly as the binding popover does.
 */
async function enableSourceInputs(
  getValues: GetValues,
  setValue: SetValue,
  scope: string,
  interactiveScope: string,
  source: string
): Promise<void> {
  const paths = interactionEnablePaths( source );

  if ( paths.length === 0 ) {
    return;
  }

  let interactionScope = scope;

  if ( getValues( `${ scope }.interaction` ) === undefined ) {
    interactionScope = interactiveScope;

    if ( getValues( `${ interactiveScope }.interaction` ) === undefined ) {
      const {
        inertInteractionFormValues
      } = await import( "@/p5/utils/interaction/defaults.js" );

      setValue(
        `${ interactiveScope }.interaction`,
        inertInteractionFormValues(),
        {
          shouldDirty: true
        }
      );
    }
  }

  for ( const path of paths ) {
    setValue(
      `${ interactionScope }.interaction.${ path }`,
      true,
      {
        shouldDirty: true
      }
    );
  }
}
