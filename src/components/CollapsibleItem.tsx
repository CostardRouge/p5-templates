import {
  CSSProperties, JSX, useState
} from "react";

type CollapsibleItemProps = {
  header: ( expanded: boolean, title: string ) => JSX.Element;
  initialExpandedValue?: boolean;
  children: React.ReactNode;
  className?: string;
  headerContainerClassName?: string;
  style?: CSSProperties;
  expanded?: boolean;
  onToggle?: ( expanded: boolean ) => void;
};

const CollapsibleItem = ( {
  header,
  children,
  className,
  headerContainerClassName,
  style,
  initialExpandedValue = true,
  expanded: controlledExpanded,
  onToggle
}: CollapsibleItemProps ) => {
  const [
    internalExpanded,
    setInternalExpanded
  ] = useState( initialExpandedValue );

  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    const nextValue = !expanded;

    if ( isControlled ) {
      onToggle?.( nextValue );
    } else {
      setInternalExpanded( nextValue );
    }
  };

  return (
    <div className={ className } style={ style }>
      <div
        className={ headerContainerClassName }
        onClick={ handleToggle }
      >
        {header(
          expanded,
          expanded ? "click to collapse" : "click to expand"
        )}
      </div>

      {expanded && children}
    </div>
  );
};

export default CollapsibleItem;