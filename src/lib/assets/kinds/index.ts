/**
 * Side-effect module: importing this file registers every built-in asset
 * kind in the registry. New kinds should be added here so they become
 * available app-wide via `getAssetKind(...)`.
 */
import {
  registerAssetKind
} from "../registry";
import {
  imagesKind
} from "./images";
import {
  videosKind
} from "./videos";

registerAssetKind( imagesKind );
registerAssetKind( videosKind );
