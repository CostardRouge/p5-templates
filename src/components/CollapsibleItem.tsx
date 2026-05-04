import {
  DetailedHTMLProps, HTMLAttributes, JSX, useState
} from "react";

const CollapsibleItem = ( {
  header,
  children,
  className,
  headerContainerClassName,
  initialExpandedValue = true,
  ...props
}: {
  header: ( expanded: boolean, title: string ) => JSX.Element;
  initialExpandedValue?: boolean;
  children: React.ReactNode;
  className?: string;
  headerContainerClassName?: string;
} & DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> ) => {
  const [
    expanded,
    setExpanded
  ] = useState( initialExpandedValue );

  return (
    <div className={ className } { ...props }>
      <div
        className={ headerContainerClassName }
        onClick={ () => setExpanded( ( e ) => !e ) }
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
