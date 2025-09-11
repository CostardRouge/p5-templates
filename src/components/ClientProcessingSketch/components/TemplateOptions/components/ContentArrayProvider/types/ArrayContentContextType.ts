import {
  useFieldArray, FieldArrayWithId, FieldValues
} from "react-hook-form";

export type ArrayContentContextType<TValues extends FieldValues> = {
  name: string;
  fields: FieldArrayWithId<TValues, any, "id">[];
  append: ReturnType<typeof useFieldArray>["append"];
  remove: ReturnType<typeof useFieldArray>["remove"];
  move: ReturnType<typeof useFieldArray>["move"];
};