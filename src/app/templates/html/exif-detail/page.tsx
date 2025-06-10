"use client";

import React, {
  useEffect, useState
} from "react";

import ImageDropzone from "./components/ImageDropzone";
import ExifInfo from "./components/ExifInfo";
import ExifReader from "exifreader";
import {
  ExifData
} from "@/types/types";

import "./exif-detail.css";

import fetchDownload from "@/components/utils/fetchDownload";

const scalingStyle = "scale-[0.375] md:scale-[0.6] lg:scale-[0.7] xl:scale-9";
const supportedObjectStyles = [
  "object-fit",
  "object-cover",
  "object-contain"
];
const supportedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
];

const ImageInfoHelper = () => {
  const [
    showExif,
    setShowExif
  ] = useState( true );
  const [
    capturing,
    setCapturing
  ] = useState( false );
  const [
    scaleRender,
    setScaleRender
  ] = useState( true );
  const [
    image,
    setImage
  ] = useState<string | null>( null );
  const [
    rawFile,
    setRawFile
  ] = useState<File | null>( null );
  const [
    exifData,
    setExifData
  ] = useState<ExifData | null>( null );
  const [
    objectStyle,
    setObjectStyle
  ] = useState<string>( supportedObjectStyles[ 0 ] );

  const handleImageFile = ( file: File ) => {
    setExifData( null );
    setImage( null );
    setRawFile( file );

    ExifReader
      .load( file )
      .then( tags => {
        const parseDate = ( tags: ExifReader.Tags ) => {
          const dateString = tags?.DateTimeOriginal?.description;

          if ( !dateString ) return;
          const [
            datePart,
            timePart
          ] = dateString.split( " " );
          const [
            year,
            month,
            day
          ] = datePart.split( ":" ).map( Number );
          const [
            hours,
            minutes,
            seconds
          ] = timePart.split( ":" ).map( Number );

          return new Date(
            year,
            month - 1,
            day,
            hours,
            minutes,
            seconds
          );
        };

        return {
          iso: Number( tags?.ISOSpeedRatings?.description ),
          shutterSpeed: {
            description: tags?.ExposureTime?.description || "",
            value: tags?.ExposureTime?.value
          },
          focalLength: {
            description: tags?.FocalLength?.description || "",
            value: tags?.FocalLength?.value
          },
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
          date: parseDate( tags ),
          gps: {
            latitude: Number( tags?.GPSLatitude?.description ) || -1,
            longitude: Number( tags?.GPSLongitude?.description ) || -1,
          }
        } as ExifData;
      } )
      .then( setExifData )
      .catch( console.error );

    if ( supportedImageTypes.includes( file.type ) ) {
      setImage( URL.createObjectURL( file ) );
    } else {
      setImage( null );
    }
  };

  const handleDownload = async() => {
    if ( !rawFile ) return;

    const formData = new FormData();

    formData.append(
      "image",
      rawFile
    );
    formData.append(
      "showExif",
      String( showExif )
    );
    formData.append(
      "objectStyle",
      objectStyle
    );

    await fetchDownload(
      "/api/capture/html/exif-detail",
      {
        method: "POST",
        body: formData,
      }
    );
  };

  useEffect(
    () => {
      const searchParams = new URLSearchParams( window.location.search );
      const imageFilename = searchParams.get( "image" );

      setShowExif( !searchParams.has( "hide-exif" ) );
      setCapturing( searchParams.has( "capturing" ) );
      setScaleRender( !searchParams.has( "zoom-to-fit" ) );

      const objectStyle = searchParams.get( "object-style" );

      if ( objectStyle ) setObjectStyle( objectStyle );

      if ( imageFilename ) {
        const imageUrl = `/api/assets?name=${ encodeURIComponent( imageFilename ) }`;

        fetch( imageUrl )
          .then( res => res.blob() )
          .then( blob => {
            handleImageFile( new File(
              [
                blob
              ],
              "image.jpg",
              {
                type: blob.type
              }
            ) );
          } )
          .catch( console.error );
      }
    },
    [
    ]
  );

  return (
    <>
      <div className="flex flex-col items-center justify-center h-[100svh] text-black">
        <div
          id="div-to-capture"
          className={`p-8 bg-white max-h-[1350px] w-[1080px] max-w-[1080px] ${ scaleRender ? scalingStyle : "" }`}
        >
          <ImageDropzone
            image={image}
            onImageDrop={handleImageFile}
            onClick={() => setShowExif( !showExif )}
          >
            <ExifInfo exifData={exifData} visible={showExif} className="flex flex-col">
              {image && (
                <img
                  id="image"
                  src={image}
                  alt="Uploaded"
                  className={`max-w-full ${ objectStyle }`}
                />
              )}
            </ExifInfo>
          </ImageDropzone>
        </div>
      </div>

      { !capturing && (
        <div
          className="flex justify-center gap-1 fixed left-0 bottom-0 w-full bg-white p-1 text-center border border-t-1 border-black sm:h-20  text-black"
        >
          {image && (
            <button
              className="rounded-sm px-4 border border-t-1 border-black capitalize"
              onClick={( e ) => {
                e.preventDefault();
                setObjectStyle( current => {
                  const i = supportedObjectStyles.indexOf( current );

                  return supportedObjectStyles[ ( i + 1 ) % supportedObjectStyles.length ];
                } );
              }}
            >
              {objectStyle.split( "-" )[ 1 ]}
            </button>
          )}

          <button
            className="rounded-sm px-4 border border-black"
            onClick={( e ) => {
              e.preventDefault();
              setScaleRender( !scaleRender );
            }}
          >
            {scaleRender ? "Zoom to 100%" : "Scale to fit"}
          </button>

          {exifData && (
            <button
              className="rounded-sm px-4 border border-black"
              onClick={( e ) => {
                e.preventDefault();
                setShowExif( !showExif );
              }}
            >
              {showExif ? "Hide exif" : "Show exif"}
            </button>
          )}

          {image && (
            <button
              className="rounded-sm px-4 border border-black"
              onClick={( e ) => {
                e.preventDefault();
                handleDownload().then();
              }}
            >
              Download the image
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default ImageInfoHelper;