'use client'

import React, { useEffect, useState } from "react";
import ImageDropzone from "./components/ImageDropzone";
import ExifInfo from "./components/ExifInfo";
import ExifReader from 'exifreader';
import { ExifData } from "@/types/types";

import "./exif-detail.css"

const ImageInfoHelper = () => {
    const [image, setImage] = useState<string | null>(null);
    const [exifData, setExifData] = useState<ExifData | null>(null);
    const [showExif, setShowExif] = useState(true);

    const handleImageFile = (file: File) => {
        setExifData(null);
        setImage(null);

        ExifReader
            .load(file)
            .then( tags => {
                console.log(tags)
                return ({
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
                }) as ExifData;
            })
            .then(setExifData)

        if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
            setImage(URL.createObjectURL(file));
        }
        else {
            setImage(null)
        }
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const imageUrl = params.get('image');

        if (imageUrl) {
            fetch(imageUrl)
                .then((response) => response.blob())
                .then((blob) => {
                    handleImageFile(new File([blob], 'image.jpg', { type: blob.type }));
                })
                .catch((error) => {
                    console.error('Error fetching image:', error);
                });
        }
    }, []);

    return (
        <ImageDropzone
            image={image}
            onImageDrop={handleImageFile}
            onClick={() => setShowExif(!showExif)}
            className="p-8"
        >
            <ExifInfo exifData={exifData} visible={showExif} className="flex flex-col justify-center">
                {image && (
                    <img
                        id="image"
                        src={image}
                        alt="Uploaded"
                        className="max-w-full object-contain"
                    />
                )}
            </ExifInfo>
        </ImageDropzone>
    );
};

export default ImageInfoHelper;