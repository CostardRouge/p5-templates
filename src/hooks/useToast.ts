"use client";

import {
  useState, useCallback
} from "react";

type ToastType = "success" | "error" | "info" | "warning";

type ToastMessage = {
  id: number;
  message: string;
  type: ToastType;
};

let toastId = 0;

export function useToast() {
  const [
    toasts,
    setToasts
  ] = useState<ToastMessage[]>( [
  ] );

  const showToast = useCallback(
    (
      message: string, type: ToastType = "info"
    ) => {
      const id = toastId++;

      setToasts( ( prev ) => [
        ...prev,
        {
          id,
          message,
          type,
        },
      ] );
    },
    [
    ]
  );

  const removeToast = useCallback(
    ( id: number ) => {
      setToasts( ( prev ) => prev.filter( ( toast ) => toast.id !== id ) );
    },
    [
    ]
  );

  return {
    toasts,
    showToast,
    removeToast,
  };
}
