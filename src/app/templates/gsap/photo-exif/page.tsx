"use client";

import React, { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import { useGSAPTimeline } from "@/lib/gsap/useGSAPTimeline";
import { PhotoExifTemplateOptions, ExifData } from "./types";
import { defaultOptions } from "./options";
import ScalableViewport from "@/components/ScalableViewport/ScalableViewport";
import ImageDropzone from "./components/ImageDropzone";
import ExifInfo from "./components/ExifInfo";
import ExifReader from "exifreader";

import "./photo-exif.css";

const supportedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export default function PhotoExifTemplate() {
  const [options, setOptions] = useState<PhotoExifTemplateOptions | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [showExif, setShowExif] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize GSAP timeline synced to options.animation
  const { timeline, progress, isReady: timelineReady } = useGSAPTimeline({
    container: containerRef as React.RefObject<HTMLElement>,
    options: options?.animation,
    capturing,
    onComplete: () => {
      // Signal capture completion
      if (capturing) {
        document.body.setAttribute('data-capture-complete', 'true');
      }
    }
  });

  // Handle image file upload and EXIF parsing
  const handleImageFile = (file: File) => {
    setExifData(null);
    setImage(null);
    setRawFile(file);

    // Parse EXIF data
    ExifReader.load(file)
      .then((tags) => {
        const parseDate = (tags: ExifReader.Tags) => {
          const dateString = tags?.DateTimeOriginal?.description;

          if (!dateString) return;
          const [datePart, timePart] = dateString.split(" ");
          const [year, month, day] = datePart.split(":").map(Number);
          const [hours, minutes, seconds] = timePart.split(":").map(Number);

          return new Date(year, month - 1, day, hours, minutes, seconds);
        };

        return {
          iso: Number(tags?.ISOSpeedRatings?.description),
          shutterSpeed: {
            description: tags?.ExposureTime?.description || "",
            value: tags?.ExposureTime?.value as [number, number],
          },
          focalLength: {
            description: tags?.FocalLength?.description || "",
            value: tags?.FocalLength?.value as [number, number],
          },
          lens: tags?.Lens?.description,
          camera: {
            brand: tags?.Make?.description || "",
            model: tags?.Model?.description || "",
          },
          aperture: {
            description: tags?.FNumber?.description || "",
            value: tags?.FNumber?.value as [number, number],
          },
          type: tags?.FileType?.description,
          date: parseDate(tags),
          gps: {
            latitude: Number(tags?.GPSLatitude?.description) || -1,
            longitude: Number(tags?.GPSLongitude?.description) || -1,
          },
        } as ExifData;
      })
      .then(setExifData)
      .catch(console.error);

    // Create image URL for display
    if (supportedImageTypes.includes(file.type)) {
      setImage(URL.createObjectURL(file));
    } else {
      setImage(null);
    }
  };

  // Load options from URL params (for capture mode) or use defaults
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const isCapturing = searchParams.has('capturing');
    setCapturing(isCapturing);
    
    // Check if EXIF should be hidden
    setShowExif(!searchParams.has('hide-exif'));
    
    // Load options from query params or use defaults
    const optionsParam = searchParams.get('options');
    if (optionsParam) {
      try {
        const parsedOptions = JSON.parse(optionsParam);
        setOptions(parsedOptions);
      } catch (error) {
        console.error('Failed to parse options:', error);
        setOptions(defaultOptions);
      }
    } else {
      setOptions(defaultOptions);
    }

    // Load image from URL if provided
    const imageFilename = searchParams.get("image");
    if (imageFilename) {
      const imageUrl = `/api/assets?name=${encodeURIComponent(imageFilename)}`;

      fetch(imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          handleImageFile(
            new File([blob], "image.jpg", {
              type: blob.type,
            })
          );
        })
        .catch(console.error);
    }
  }, []);

  // Mark as ready when options and timeline are ready
  useEffect(() => {
    if (options && timelineReady) {
      setIsReady(true);
    }
  }, [options, timelineReady]);

  // Define GSAP animations
  useEffect(() => {
    if (!timeline || !isReady || !options || !image) return;

    // Clear previous animations
    timeline.clear();

    const duration = options.animation.duration;
    
    // Calculate timing for different animation phases
    // Phase 1: Image entrance (0-30% of duration)
    // Phase 2: EXIF data reveal (20-60% of duration)
    // Phase 3: Hold final state (60-100% of duration)
    
    const imageEntranceDuration = duration * 0.3;
    const exifRevealStart = duration * 0.2;
    const exifRevealDuration = duration * 0.4;
    
    // Set initial states
    gsap.set('#image', { 
      opacity: 0, 
      scale: 0.95,
      transformOrigin: 'center center'
    });
    
    gsap.set('#exif-info', { 
      opacity: 0,
    });
    
    // Phase 1: Animate image entrance
    timeline.to('#image', {
      opacity: 1,
      scale: 1,
      duration: imageEntranceDuration,
      ease: 'power2.out',
    }, 0);
    
    // Phase 2: Reveal EXIF data with staggered animation
    // Top EXIF info (date and location)
    timeline.to('#exif-info', {
      opacity: 1,
      duration: exifRevealDuration * 0.5,
      ease: 'power2.out',
    }, exifRevealStart);
    
    // Animate individual EXIF elements if they exist
    const exifElements = containerRef.current?.querySelectorAll('#exif-info > div');
    if (exifElements && exifElements.length > 0) {
      // Set initial state for individual elements
      gsap.set(exifElements, { 
        opacity: 0,
        y: 20,
      });
      
      // Stagger the reveal of EXIF elements
      timeline.to(exifElements, {
        opacity: 1,
        y: 0,
        duration: exifRevealDuration * 0.6,
        stagger: 0.1,
        ease: 'power2.out',
      }, exifRevealStart + exifRevealDuration * 0.2);
    }
    
    // Ensure timeline duration matches options
    if (timeline.duration() < duration) {
      timeline.to({}, { duration: duration - timeline.duration() });
    }

  }, [timeline, isReady, options, image]);

  if (!options) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  const backgroundColor = `rgb(${options.photo.backgroundColor.join(',')})`;

  return (
    <ScalableViewport
      initialScale={capturing ? 1 : undefined}
      showZoomControls={!capturing}
      disable={capturing}
    >
      <div className="flex items-center justify-center h-screen">
        <div
          id="capture-container"
          ref={containerRef}
          className="w-[1080px] h-[1350px] p-16"
          style={{ backgroundColor }}
          data-ready={isReady}
        >
          <ImageDropzone image={image} onImageDrop={handleImageFile}>
            <ExifInfo
              exifData={exifData}
              visible={showExif}
              className="flex flex-col"
            >
              {image && (
                <img
                  id="image"
                  src={image}
                  alt="Uploaded"
                  className="max-w-full object-cover"
                />
              )}
            </ExifInfo>
          </ImageDropzone>
        </div>
      </div>
    </ScalableViewport>
  );
}
