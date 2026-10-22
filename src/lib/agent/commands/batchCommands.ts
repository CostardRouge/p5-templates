/**
 * Several commands as ONE request — and therefore one undo step
 * (`transaction.ts`): "apply this theme" is a sketch.set, a canvas.set and a
 * content.add that a single Cmd+Z takes back together.
 */
import {
  CommandError, isImageResult, isRecord, type CommandRegistry, type CommandSpec
} from "../../../../scripts/mcp/registry.ts";
import {
  UNGROUPED_COMMANDS
} from "../transaction";

/** No batch inside a batch; the ungrouped commands would run under the batch's paused history. */
const NOT_IN_BATCH: ReadonlySet<string> = new Set( [
  "studio.batch",
  ...UNGROUPED_COMMANDS
] );

export function batchCommands( registry: CommandRegistry ): CommandSpec[] {
  return [
    {
      id: "studio.batch",
      title: "Run several commands as one step",
      description: "Run a list of commands in order as ONE request — one undo step for all of them (each command alone is one step already). Stops at the first failure: the steps before it stay applied, as one undo step, and the error says which step failed and why. A step answering a picture is replaced by its note — take snapshots separately. studio.open, export.run, history.* and studio.batch itself cannot be steps.",
      params: {
        steps: {
          type: "objects",
          description: "[ { \"command\": \"sketch.set\", \"params\": { … } }, … ] in order"
        }
      },
      async run( params ) {
        const steps = params.steps as Record<string, unknown>[];

        if ( !steps.length ) {
          throw new CommandError(
            "invalid",
            "steps is empty — give at least one { command, params }"
          );
        }
        steps.forEach( (
          step, i
        ) => {
          if ( typeof step.command !== "string" ) {
            throw new CommandError(
              "invalid",
              `step ${ i } has no "command" — each step is { command, params }`
            );
          }
          if ( step.params !== undefined && !isRecord( step.params ) ) {
            throw new CommandError(
              "invalid",
              `step ${ i } (${ step.command }): "params" must be an object`
            );
          }
          if ( NOT_IN_BATCH.has( step.command ) ) {
            throw new CommandError(
              "invalid",
              `step ${ i }: ${ step.command } cannot run inside a batch — call it on its own`
            );
          }
          for ( const key of Object.keys( step ) ) {
            if ( key !== "command" && key !== "params" ) {
              throw new CommandError(
                "invalid",
                `step ${ i } has an unknown key "${ key }" — each step is { command, params }`
              );
            }
          }
        } );

        const results: { command: string;
          result: unknown }[] = [];

        for ( const [
          i,
          step
        ] of steps.entries() ) {
          const command = step.command as string;

          try {
            const result = await registry.execute(
              command,
              step.params
            );

            results.push( {
              command,
              result: isImageResult( result ) ? {
                kind: "image",
                note: result.note ?? "(picture omitted)"
              } : result
            } );
          } catch( error ) {
            const inner = error instanceof CommandError ? error : new CommandError(
              "failed",
              error instanceof Error ? error.message : String( error )
            );

            throw new CommandError(
              inner.code,
              `step ${ i } (${ command }): ${ inner.message }${ i ? ` — steps 0 to ${ i - 1 } were applied and are one undo step` : " — nothing was applied" }${ i < steps.length - 1 ? `; steps ${ i + 1 } to ${ steps.length - 1 } did not run` : "" }`
            );
          }
        }

        return {
          applied: results.length,
          steps: results
        };
      }
    }
  ];
}
