/**
 * One agent request = one undo step.
 *
 * `FormUndoRedo` captures a history entry 400 ms after the last form write, so
 * on its own the history groups by TIME: a request's synchronous writes make
 * one entry, but two requests 300 ms apart (an agent's usual pace) fold into
 * one, an agent's write lands in the entry of a person's edit made just
 * before, and a request whose writes spread over more than 400 ms (a batch,
 * a slide handler waiting on a thumbnail) splits in two. Wrapping each
 * command's `run` in `handles.transaction` groups by REQUEST instead: flush
 * what is pending, pause auto-capture, run, resume, capture once.
 */
import type {
  CommandSpec
} from "../../../scripts/mcp/registry.ts";
import type {
  StudioHandles
} from "./handles";

/**
 * Commands that must not open a transaction: one leaves the page (its form,
 * and this history, unmount), one may run for half an hour (pausing capture
 * that long would fold the person's own edits into the agent's step), and
 * undo/redo are the history's own moves, not writes.
 */
export const UNGROUPED_COMMANDS: ReadonlySet<string> = new Set( [
  "studio.open",
  "export.run",
  "history.undo",
  "history.redo"
] );

/** Every spec's `run` inside a transaction named after the command, but the ungrouped ones. */
export function withTransactions(
  specs: CommandSpec[], h: Pick<StudioHandles, "transaction">
): CommandSpec[] {
  return specs.map( ( spec ) => UNGROUPED_COMMANDS.has( spec.id )
    ? spec
    : {
      ...spec,
      run: ( params ) => h.transaction(
        spec.id,
        async() => spec.run( params )
      )
    } );
}
