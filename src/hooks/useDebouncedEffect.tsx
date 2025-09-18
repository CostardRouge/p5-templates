import React from "react";

export function useDebouncedEffect(
  fn: () => void, deps: any[], delay = 250
) {
  React.useEffect(
    () => {
      const t = setTimeout(
        fn,
        delay
      );

      return () => clearTimeout( t );
    },
    [
      delay,
      fn,
      deps
    ]
  );
}