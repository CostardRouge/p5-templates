const friendlyCameraModelNames = {
    "ILCE-7CM2": "ALPHA 7CII"
};

const exif = {
    load: (file) => {
        return ExifReader.load(file)
            .then( tags => ({
                iso: Number(tags?.ISOSpeedRatings?.description),
                shutterSpeed: {
                    description: tags?.ExposureTime?.description || "",
                    // @ts-expect-error NEEDS
                    value: tags?.ExposureTime.value
                },
                focalLength: {
                    description: tags?.FocalLength?.description || "",
                    // @ts-expect-error NEEDS
                    value: tags?.FocalLength.value
                },
                // lens: tags?.LensModel?.description,
                lens: tags?.Lens?.description,
                camera: {
                    brand: tags?.Make?.description || "",
                    model: tags?.Model?.description || ""
                },
                aperture: {
                    description: tags?.FNumber?.description || "",
                    value: tags?.FNumber?.value,
                },
                type: tags?.FileType?.description,
                date: new Date(tags?.DateCreated?.description),
                gps: {
                    latitude: Number(tags?.GPSLatitude?.description) || -1,
                    longitude: Number(tags?.GPSLongitude?.description) || -1,
                }
            }) );
    },
    formatFocalLength: (focalLength) => {
        if (!focalLength) {
            return;
        }

        const [ numerator, denominator ] = focalLength.value;
        const FL = (numerator/denominator).toPrecision(4).replace(".00", "")

        return `${FL} MM`
    },

    formatShutterSpeed: (speed) => {
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
    },
    formatAperture: (aperture) => {
        if (!aperture) {
            return;
        }

        const [ numerator, denominator ] = aperture.value;
        const fStop = (numerator/denominator).toFixed(1)

        return `ƒ/${fStop}`
    },
    formatCameraModel: (camera) => {
        if (!camera) {
            return;
        }

        const { brand, model } = camera;

        return `${brand} ${friendlyCameraModelNames[model] ?? model}`
    },
    formatPhotoDate: (date) => {
        if (!date) {
            return;
        }

        const formatter = new Intl.DateTimeFormat('en-GB', {
            // weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });

        return formatter.format(date);
    }
};

export default exif;
