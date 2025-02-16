import { ExifData } from "@/types/types";

interface ExifInfoProps {
  exifData: ExifData | null;
  visible: boolean;
}

const ExifInfo = ({ exifData, visible }: ExifInfoProps) => {
  if (![exifData?.iso, exifData?.shutterSpeed, exifData?.aperture].every(Boolean)) return null;

  const formatFocalLength = (focalLength?: ExifData["focalLength"]) => {
    if (!focalLength) {
      return;
    }

    const [ numerator, denominator ] = focalLength.value;
    const FL = (numerator/denominator).toPrecision(4).replace(".00", "")

    return `${FL} MM`
  };

  const formatShutterSpeed = (speed?: ExifData["shutterSpeed"]) => {
    if (!speed) {
      return;
    }

    const [ numerator, denominator ] = speed.value;

    if (numerator > 1) {
      return `${speed.description}"`
    }

    if (numerator === 1 && denominator === 1) {
      return `1"`
    }

    return `${numerator}/${denominator}s`
  };

  const formatAperture = (aperture?: ExifData["aperture"]) => {
    if (!aperture) {
      return;
    }

    const [ numerator, denominator ] = aperture.value;
    const fStop = (numerator/denominator).toFixed(1)

    return `ƒ/${fStop}`
  };

  if (visible && exifData) {
    return (
        <div
            id="exif-info"
            className="flex gap-8 pt-8"
        >
          <div className="flex items-center">
            <span className="text-gray-700">{formatFocalLength(exifData.focalLength)}</span>
          </div>

          <div className="flex items-center">
            <span className="text-gray-700">{formatAperture(exifData.aperture)}</span>

          </div>

          <div className="flex items-center">
            <span className="text-gray-700">{formatShutterSpeed(exifData.shutterSpeed)}</span>
          </div>

          <div className="flex items-center">
            <span className="text-gray-700">ISO {exifData.iso}</span>
          </div>
        </div>
    )
  }

  return null
};

export default ExifInfo;