import React, { useState } from "react";

interface ImageDropzoneProps {
  onImageDrop: (data: File) => void;
  image: string | null,
  children: React.ReactNode;
  onClick: () => void;
}

const ImageDropzone = ({ image, onImageDrop, children, onClick }: ImageDropzoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    onImageDrop(file);
  };

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={onClick}
    >
      {image !== null ? children : (
          <label
              htmlFor="file-input"
              className="cursor-pointer"
          >
            <div
                className={
                  `w-full aspect-video border-2 border-dashed transition-colors duration-200 flex flex-col items-center justify-center cursor-pointer ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}`
                }
            >

              <div className="flex flex-col items-center gap-4">
                Upload
              </div>
            </div>
          </label>
      )}

      <input
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
          name="image"
          id="file-input"
      />
    </div>
  );
};

export default ImageDropzone;