/**
 * Type definitions for photo-exif GSAP template
 */

/**
 * EXIF data extracted from image files
 */
export type ExifData = {
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
};

/**
 * Template options for photo-exif template
 */
export interface PhotoExifTemplateOptions {
  animation: {
    duration: number;
    framerate: number;
  };
  photo: {
    image: string | null;
    margin: number;
    backgroundColor: [number, number, number];
  };
  font: {
    face: string;
    size: number;
    color: [number, number, number];
    stroke: [number, number, number];
  };
  textOverrides: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
  };
}
