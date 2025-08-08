import {
  DetailedHTMLProps,
  HTMLAttributes,
  JSX,
  useState
} from "react";
import {
  Property
} from "csstype";

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
        className="cursor-pointer"
        onClick={() => setExpanded( e => !e )}
      >
        {header( expanded )}
      </div>

      {expanded && children}
    </div>
  );
};

export default CollapsibleItem;