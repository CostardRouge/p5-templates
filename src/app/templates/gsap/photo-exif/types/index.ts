/**
 * Type definitions for photo-exif GSAP template
 */

import {
  GSAPTemplateOptions
} from "@/types/gsap-template.types";

/**
 * Photo configuration options
 */
export interface PhotoOptions {
  image: string | null;
  margin: number;
  backgroundColor: [number, number, number];
}

/**
 * Font styling options
 */
export interface FontOptions {
  face: string;
  size: number;
  color: [number, number, number];
  stroke: [number, number, number];
}

/**
 * Text override options for EXIF display
 */
export interface TextOverrides {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
}

/**
 * Complete options interface for photo-exif template
 */
export interface PhotoExifTemplateOptions extends GSAPTemplateOptions {
  photo: PhotoOptions;
  font: FontOptions;
  textOverrides: TextOverrides;
}

/**
 * EXIF data structure (matches original implementation)
 */
export interface ExifData {
  iso: number;
  shutterSpeed: {
    description: string;
    value: [number, number];
  };
  focalLength: {
    description: string;
    value: [number, number];
  };
  aperture: {
    description: string;
    value: [number, number];
  };
  type: string;
  lens: string;
  camera: {
    brand: string;
    model: string;
  };
  date: Date;
  gps: {
    latitude: number;
    longitude: number;
  };
}
