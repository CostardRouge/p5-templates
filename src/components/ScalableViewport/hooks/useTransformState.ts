import {
  useCallback, useRef, useState
} from "react";

export interface TransformState {
  x: number;
  y: number;
  scale: number;
}

export function useTransformState( initialScale: number = 1 ) {
  const transform = useRef<TransformState>( {
    x: 0,
    y: 0,
    scale: initialScale,
  } );

  const [
    displayScale,
    setDisplayScale
  ] = useState( initialScale );

  const updateDom = useCallback(
    ( contentElement: HTMLDivElement | null ) => {
      if ( contentElement ) {
        const {
          x, y, scale
        } = transform.current;

        contentElement.style.transform = `translate(${ x }px, ${ y }px) scale(${ scale })`;
        contentElement.style.setProperty(
          "--viewport-scale",
          scale.toString()
        );
      }
    },
    [
    ]
  );

  const setTransform = useCallback(
    (
      newValues: Partial<TransformState>,
      contentElement: HTMLDivElement | null
    ) => {
      transform.current = {
        ...transform.current,
        ...newValues,
      };
      updateDom( contentElement );
      if ( newValues.scale !== undefined ) {
        setDisplayScale( newValues.scale );
      }
    },
    [
      updateDom
    ]
  );

  return {
    transform,
    displayScale,
    setTransform,
  };
}
