"use client";

import React, {
  useEffect, useState
} from "react";

import ImageDropzone from "./components/ImageDropzone";
import ExifInfo from "./components/ExifInfo";
import ExifReader from "exifreader";
import {
  ExifData
} from "./types/ExifData";

import "./exif-detail.css";

import {
  ExternalLink, Loader, SaveIcon
} from "lucide-react";
import ScalableViewport from "@/components/ScalableViewport/ScalableViewport";

const supportedObjectStyles = [
  "object-cover",
  "object-contain",
  "object-fit"
];
const supportedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
];

const ImageInfoHelper = () => {
  const [
    rendering,
    setRendering
  ] = useState( false );

  const [
    showExif,
    setShowExif
  ] = useState( true );
  const [
    capturing,
    setCapturing
  ] = useState( false );
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

  const submitDownloadForm = async( target: "_self" | "_blank" = "_self" ) => {
    if ( !rawFile ) return;

    setRendering( true );

    try {
      if ( !rawFile ) return;

      const form = document.createElement( "form" );

      form.action = "/api/capture/html/exif-detail";
      form.method = "POST";
      form.enctype = "multipart/form-data";
      form.target = target;

      // image file input
      const fileInput = document.createElement( "input" );

      fileInput.type = "file";
      fileInput.name = "image";
      // convert File to FileList to assign
      const dataTransfer = new DataTransfer();

      dataTransfer.items.add( rawFile );
      fileInput.files = dataTransfer.files;
      form.appendChild( fileInput );

      // other hidden inputs
      const inputs = [
        [
          "showExif",
          String( showExif )
        ],
        [
          "objectStyle",
          objectStyle
        ],
        [
          "contentDisposition",
          target === "_self" ? "attachment" : "inline",
        ],
      ];

      for ( const [
        name,
        value
      ] of inputs ) {
        const input = document.createElement( "input" );

        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild( input );
      }

      document.body.appendChild( form );
      form.submit();
      document.body.removeChild( form );
    } finally {
      setRendering( false );
    }
  };

  useEffect(
    () => {
      const searchParams = new URLSearchParams( window.location.search );
      const imageFilename = searchParams.get( "image" );

      setShowExif( !searchParams.has( "hide-exif" ) );
      setCapturing( searchParams.has( "capturing" ) );

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
      <ScalableViewport
        initialScale={ capturing ? 1 : undefined }
        showZoomControls={ !capturing }
      >
        <div className="flex flex-col items-center justify-center h-[100svh] text-black">
          <div
            id="div-to-capture"
            className={"p-16 bg-white h-[1350px] w-[1080px]"}
          >
            <ImageDropzone
              image={image}
              onImageDrop={handleImageFile}
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
      </ScalableViewport>

      {!capturing && image && (
        <div
          data-no-zoom=""
          className="w-64 flex flex-col gap-1 absolute right-0 bottom-0 bg-white p-2 border border-b-0 border-gray-400 shadow shadow-black-300 drop-shadow-sm border-r-0 z-50 rounded-tl-sm"
          style={{
            maxHeight: "calc(60svh)",
          }}
        >
          {image && (
            <button
              className="rounded-sm p-2 border border-gray-400 shadow shadow-gray-200 disabled:opacity-50 text-gray-500 hover:text-black active:text-black bg-white text-sm"
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

          {exifData && !Number.isNaN( exifData?.iso ) && (
            <button
              className="rounded-sm p-2 border border-gray-400 shadow shadow-gray-200 disabled:opacity-50 text-gray-500 hover:text-black active:text-black bg-white text-sm"
              onClick={( e ) => {
                e.preventDefault();
                setShowExif( !showExif );
              }}
            >
              {showExif ? "Hide exif" : "Show exif"}
            </button>
          )}

          {image && (

            <div className="flex gap-1 h-auto">
              <button
                className=" flex-grow rounded-sm p-2 border border-gray-400 shadow shadow-gray-200 disabled:opacity-50 text-gray-500 hover:text-black active:text-black bg-white text-sm"
                onClick={async() => await submitDownloadForm( "_self" )}
              >
                {rendering ? <Loader className="inline mr-1 h-4 animate-spin"/> :
                  <SaveIcon className="inline mr-1 h-4"/>}
                <span className="align-middle">Download</span>
              </button>

              <button
                className="rounded-sm p-2 border border-gray-400 shadow shadow-gray-200 disabled:opacity-50 text-gray-500 hover:text-black active:text-black bg-white text-sm"
                onClick={async() => await submitDownloadForm( "_blank" )}
              >
                {rendering ? <Loader className="inline mr-1 h-4 animate-spin"/> :
                  <ExternalLink className="inline mr-1 h-4"/>}
                <span className="align-middle">Open</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ImageInfoHelper;