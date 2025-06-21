import {
  ExifData
} from "@/types/types";
import React, {
  useState, useEffect
} from "react";
import {
  MapPin, CalendarClock
} from "lucide-react";

interface ExifInfoProps {
  children: React.ReactNode;
  exifData: ExifData | null;
  className?: string;
  visible: boolean;
}

const friendlyCameraModelNames: Record<string, string> = {
  "ILCE-7CM2": "ALPHA 7CII",
  "ILCE-6700": "ALPHA A6700",
};

async function formatGPSCoordinates( coordinates?: ExifData["gps"] ) {
  if ( !coordinates ) {
    return null;
  }

  const {
    latitude, longitude
  } = coordinates;

  if ( latitude === -1 || longitude === -1 ) {
    return null;
  }

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${ latitude }&lon=${ longitude }&format=json`;

  try {
    const response = await fetch( url );
    const data = await response.json();

    console.log( data );

    if ( data.address ) {
      return data.address.city || data.address.town || data.address.village || formatCoordinates(
        latitude,
        longitude
      );
    }
  } catch ( error ) {
    console.error(
      "Error fetching city:",
      error
    );
  }

  return formatCoordinates(
    latitude,
    longitude
  );
}

function formatCoordinates(
  latitude: number, longitude: number, precision = 2
) {
  const latDir = latitude >= 0 ? "N" : "S";
  const lonDir = longitude >= 0 ? "E" : "W";

  return `${ Math.abs( latitude ).toFixed( precision ) }° ${ latDir }, ${ Math.abs( longitude ).toFixed( precision ) }° ${ lonDir }`;
}

const ExifInfo = ( {
  exifData, visible, className, children
}: ExifInfoProps ) => {
  const [
    computedGPSInfo,
    setComputedGPSInfo
  ] = useState<string | null | undefined>( undefined );

  console.log( {
    computedGPSInfo
  } );

  useEffect(
    () => {
      if ( !exifData?.gps ) {
        return setComputedGPSInfo( null );
      }

      formatGPSCoordinates( exifData?.gps ).then( setComputedGPSInfo );
    },
    [
      exifData?.gps
    ]
  );

  const formatFocalLength = ( focalLength?: ExifData["focalLength"] ) => {
    if ( !focalLength || !focalLength.value ) {
      return;
    }

    const [
      numerator,
      denominator
    ] = focalLength.value;
    const FL = ( numerator / denominator ).toPrecision( 4 ).replace(
      ".00",
      ""
    );

    return `${ FL } MM`;
  };

  const formatShutterSpeed = ( speed?: ExifData["shutterSpeed"] ) => {
    if ( !speed || !speed.value ) {
      return;
    }

    const [
      numerator,
      denominator
    ] = speed.value;

    if ( numerator > 1 ) {
      return `${ speed.description }"`;
    }

    if ( numerator === 1 && denominator === 1 ) {
      return "1\"";
    }

    return `${ numerator }/${ denominator }s`;
  };

  const formatAperture = ( aperture?: ExifData["aperture"] ) => {
    if ( !aperture || !aperture.value ) {
      return;
    }

    const [
      numerator,
      denominator
    ] = aperture.value;
    const fStop = ( numerator / denominator ).toFixed( 1 );

    return `ƒ/${ fStop }`;
  };

  const formatCameraModel = ( camera?: ExifData["camera"] ) => {
    if ( !camera ) {
      return;
    }

    const {
      brand, model
    } = camera;

    return `${ brand } ${ friendlyCameraModelNames[ model ] ?? model }`;
  };

  const formatPhotoDate = ( date?: ExifData["date"] ) => {
    if ( !date ) {
      return;
    }

    const formatter = new Intl.DateTimeFormat(
      "en-GB",
      {
      // weekday: 'short',
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );

    return formatter.format( date );
  };

  return (
    <div id={computedGPSInfo === undefined ? "loading" : "loaded"} className={className}>
      { visible && exifData && (
        <div
          id="exif-info"
          className="flex justify-between pb-8 text-2xl"
        >
          {
            exifData.date && (
              <div className="flex gap-8">
                <div className="flex uppercase">
                  <CalendarClock className="inline mr-1.5 h-8"/>
                  <span>{formatPhotoDate( exifData.date )}</span>
                </div>
              </div>
            )
          }

          { computedGPSInfo && (
            <div className="flex">
              <span className="text-gray-700 uppercase">
                <MapPin className="inline mr-1.5 h-8 align-top"/>
                <span>
                  {computedGPSInfo}
                </span>
              </span>
            </div>
          ) }
        </div>
      )}

      { children}

      { visible && exifData && (
        <div
          id="exif-info"
          className="flex justify-between pt-8 text-2xl"
        >
          <div className="flex gap-8">
            <div className="flex">
              <span className="text-gray-700">{formatFocalLength( exifData.focalLength )}</span>
            </div>

            <div className="flex">
              <span className="text-gray-700">{formatAperture( exifData.aperture )}</span>
            </div>

            <div className="flex">
              <span className="text-gray-700">{formatShutterSpeed( exifData.shutterSpeed )}</span>
            </div>

            <div className="flex">
              <span className="text-gray-700">{ Boolean( exifData.iso ) && `ISO ${ exifData.iso }`}</span>
            </div>
          </div>

          <div className="flex">
            <span className="text-gray-700 uppercase">
              {formatCameraModel( exifData.camera )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExifInfo;