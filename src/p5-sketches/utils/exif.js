import scripts from "./scripts.js";

export const friendlyCameraModelNames = {
  FC8482: "MINI 4 PRO",
  "ILCE-7CM2": "ALPHA 7CII",
  "ILCE-6700": "ALPHA A6700",
};

export const friendlyLensModelNames = {
  "Sony FE 16mm F1.8 G (SEL16F18G)": "Sony FE 16mm F1.8 G",
  "Sony FE PZ 16-35mm F4 G (SELP1635G)": "Sony FE PZ 16-35mm F4 G",
  "Sony FE 24mm F2.8 G (SEL24F28G)": "Sony FE 24mm F2.8 G",
  "Sony FE 50mm F1.4 GM (SEL50F14GM)": "Sony FE 50mm F1.4 GM",
  "Sony FE 24-105mm F4 G OSS (SEL24105G)": "Sony FE 24-105mm F4 G OSS",
  "Sony FE 70-200mm F2.8 GM OSS II (SEL70200GM2)":
    "Sony FE 70-200mm F2.8 GM II",

  "iPhone 15 Pro Max back triple camera 6.765mm f/1.78":
    "iPhone 15 Pro Max 24mm equiv.",
};

const exif = {
  loadedScripts: false,
  loadScripts: async() => {
    if ( exif.loadedScripts !== false ) {
      return;
    }

    await scripts.load( "/assets/libraries/exif-reader.js" );
    exif.loadedScripts = true;
  },
  load: async( file ) => {
    await exif.loadScripts();

    const result = ExifReader.load( file );

    const tags = typeof result?.then === "function" ? await result : result;

    return {
      iso: Number( tags?.ISOSpeedRatings?.description ),
      shutterSpeed: {
        description: tags?.ExposureTime?.description || "",
        value: tags?.ExposureTime?.value || -1,
      },
      focalLength: {
        description: tags?.FocalLength?.description || "",
        value: tags?.FocalLength?.value || -1,
      },
      lens: tags?.Lens?.description, // ou LensModel
      camera: {
        brand: tags?.Make?.description || "",
        model: tags?.Model?.description || "",
      },
      aperture: {
        description: tags?.FNumber?.description || "",
        value: tags?.FNumber?.value || -1,
      },
      type: tags?.FileType?.description,
      date: tags?.DateCreated ? new Date( tags?.DateCreated?.description ) : null,
      gps: {
        latitude: Number( tags?.GPSLatitude?.description ) || -1,
        longitude: Number( tags?.GPSLongitude?.description ) || -1,
      },
    };
  },
  formatFocalLength: ( focalLength ) => {
    if ( !focalLength ) {
      return;
    }

    if ( -1 === focalLength.value ) {
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
  },

  formatShutterSpeed: ( speed ) => {
    if ( !speed ) {
      return;
    }

    if ( -1 === speed.value ) {
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
  },
  formatAperture: ( aperture ) => {
    if ( !aperture ) {
      return;
    }

    if ( -1 === aperture.value ) {
      return;
    }

    const [
      numerator,
      denominator
    ] = aperture.value;
    const fStop = ( numerator / denominator ).toFixed( 1 );

    return `ƒ/${ fStop }`;
  },
  formatISO: ( iso ) => {
    if ( !iso ) {
      return;
    }

    return `ISO ${ iso }`;
  },
  formatCameraModel: ( camera ) => {
    if ( !camera ) {
      return;
    }

    const {
      brand, model
    } = camera;

    return `${ brand } ${ friendlyCameraModelNames[ model ] ?? model }`;
  },
  formatLensModel: ( lens ) => {
    if ( !lens ) {
      return;
    }

    return `${ friendlyLensModelNames[ lens ] ?? lens }`;
  },
  formatPhotoDate: ( date ) => {
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
  },
  formatGPSCoordinates: (
    latitude, longitude, precision = 2
  ) => {
    if (
      -1 === latitude ||
      -1 === longitude ||
      isNaN( latitude ) ||
      isNaN( longitude )
    ) {
      return;
    }

    const latDir = latitude >= 0 ? "N" : "S";
    const lonDir = longitude >= 0 ? "E" : "W";

    return `${ Math.abs( latitude ).toFixed( precision ) }° ${ latDir }, ${ Math.abs( longitude ).toFixed( precision ) }° ${ lonDir }`;
  },
};

export default exif;
