'use client'

import React, { useEffect, useState } from "react";
import ImageDropzone from "./components/ImageDropzone";
import ExifInfo from "./components/ExifInfo";
import ExifReader from 'exifreader';
import { ExifData } from "@/types/types";

import "./exif-detail.css";

const scalingStyle = "scale-[0.375] md:scale-[0.6] lg:scale-[0.7] xl:scale-9";
const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const ImageInfoHelper = () => {
    const [image, setImage] = useState<string | null>(null);
    const [exifData, setExifData] = useState<ExifData | null>(null);
    const [showExif, setShowExif] = useState(true);
    const [scaleRender, setScaleRender] = useState(true);

    console.log({image})

    const handleImageFile = (file: File) => {
        setExifData(null);
        setImage(null);

        ExifReader
            .load(file)
            .then( tags => {
                const parseDate= (tags: ExifReader.Tags) => {
                    const dateString = tags?.DateTimeOriginal?.description;

                    if (!dateString) {
                        return;
                    }

                    const [datePart, timePart] = dateString.split(" ");

                    const [year, month, day] = datePart.split(":").map(Number);
                    const [hours, minutes, seconds] = timePart.split(":").map(Number);

                    return new Date(year, month - 1, day, hours, minutes, seconds);
                }

                console.log(tags)
                return ({
                    iso: Number(tags?.ISOSpeedRatings?.description),
                    shutterSpeed: {
                        description: tags?.ExposureTime?.description || "",
                        value: tags?.ExposureTime?.value
                    },
                    focalLength: {
                        description: tags?.FocalLength?.description || "",
                        value: tags?.FocalLength?.value
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
                    date: parseDate(tags),
                    gps: {
                        latitude: Number(tags?.GPSLatitude?.description) || -1,
                        longitude: Number(tags?.GPSLongitude?.description) || -1,
                    }
                }) as ExifData;
            })
            .then(setExifData)
            .catch(console.error);

        if (supportedImageTypes.includes(file.type)) {
            return setImage(URL.createObjectURL(file));
        }

        setImage(null)
    }

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const imageFilename = urlParams.get('image');

        setShowExif(!urlParams.has("hide-exif"));
        setScaleRender(!urlParams.has("zoom-to-fit"));

        if (imageFilename) {
            const imageUrl = `/api/tmp-file?name=${encodeURIComponent(imageFilename)}`;

            fetch(imageUrl)
                .then(response => response.blob())
                .then(blob => {
                    handleImageFile(new File([blob], 'image.jpg', { type: blob.type }));
                })
                .catch(error => {
                    console.error('Error fetching image:', error);
                });
        }
    }, []);

    return (
        <form
            action="/api/capture/html/exif-detail"
            encType="multipart/form-data"
            method="POST"
        >
            <div className="flex flex-col items-center justify-center h-[100svh]">
                <div
                    id="div-to-capture"
                    className={`p-8 bg-white max-h-[1350px] w-[1080px] max-w-[1080px] ${scaleRender ? scalingStyle : ''}`}
                >
                    <ImageDropzone
                        image={image}
                        onImageDrop={handleImageFile}
                        onClick={() => setShowExif(!showExif)}
                    >
                        <ExifInfo exifData={exifData} visible={showExif} className="flex flex-col">
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
                </div>
            </div>

            <div
                className="flex justify-center gap-1 fixed left-0 bottom-0 w-full bg-white p-1 text-center border border-t-1 border-black"
            >
                {exifData && (
                    <button
                        className="rounded-sm px-4 border border-t-1 border-black"
                        onClick={event => {
                            event.preventDefault();
                            setShowExif(!showExif);
                        }}
                    >
                        {showExif ? "Hide exif" : "Show exif"}
                    </button>
                )}

                <input type="hidden" name="showExif" value={showExif ? "true" : "false"} />

                <button
                    className="rounded-sm px-4 border border-t-1 border-black"
                    onClick={event => {
                        event.preventDefault();
                        setScaleRender(!scaleRender);
                    }}
                >
                    {scaleRender ? "Zoom to 100%" : "Scale to fit"}
                </button>

                {image && (
                    <button
                        type="submit"
                        className="rounded-sm px-4 border border-t-1 border-black"
                    >
                        Download the image
                    </button>
                )}
            </div>
        </form>
    );
};

export default ImageInfoHelper;