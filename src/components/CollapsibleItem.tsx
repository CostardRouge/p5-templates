import {
  DetailedHTMLProps,
  HTMLAttributes,
  JSX,
  useState
} from "react";

const CollapsibleItem = ( {
  header, children, className, initialExpandedValue = true, ...props
}: {
  header: ( expanded: boolean ) => JSX.Element;
  initialExpandedValue?: boolean,
  children: React.ReactNode;
  className?: string;
} & DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> ) => {
  const [
    expanded,
    setExpanded
  ] = useState( initialExpandedValue );

  return (
    <div
      className={className}
      {...props}
    >
      <div
        onClick={() => setExpanded( e => !e )}
        title={expanded ? "click to collapse" : "click to expand"}
      >
        {header( expanded )}
      </div>

      {expanded && children}
    </div>
  );
};

export default CollapsibleItem;