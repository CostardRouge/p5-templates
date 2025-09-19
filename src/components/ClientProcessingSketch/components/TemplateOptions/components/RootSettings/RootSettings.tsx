"use client";

import React from "react";
import rootFormConfig from "./constants/root-field-config";

import GenericObjectForm from "./components/GenericObjectForm/GenericObjectForm";

export default function RootSettings() {
  return (
    <div className="p-1 border rounded-sm bg-white hover:shadow hover:border-gray-300 text-black">
      {/* <div className="text-xs text-gray-500">settings</div>*/}

      <GenericObjectForm config={rootFormConfig} />
    </div>
  );
}
