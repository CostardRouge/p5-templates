export type ExifData = {
  iso: number,
  shutterSpeed: {
    description: string,
    value: [number, number],
  },
  focalLength: {
    description: string,
    value: [number, number],
  },
  aperture: {
    description: string,
    value: [number, number],
  },
  type: string,
  lens: string,
  camera: {
    brand: string,
    model: string,
  },
  date: Date,
  gps: {
    latitude: number
    longitude: number
  }
}