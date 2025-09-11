import {
  createContext
} from "react";

import type {
  ArrayContentContextType
} from "../types/ArrayContentContextType";

import {
  ContentItem
} from "@/types/sketch.types";

const ArrayContentContext = createContext<ArrayContentContextType<ContentItem> | null>( null );

export default ArrayContentContext;