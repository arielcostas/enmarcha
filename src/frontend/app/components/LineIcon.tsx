import React, { useMemo } from "react";
import "./LineIcon.css";

interface LineIconProps {
  line: string;
  mode?: "rounded" | "pill" | "default";
  colour?: string;
  textColour?: string;
}

const LineIcon: React.FC<LineIconProps> = ({
  line,
  mode = "default",
  colour,
  textColour,
}) => {
  const actualLine = useMemo(() => {
    return line.trim().replace("510", "NAD");
  }, [line]);

  const formattedLine = useMemo(() => {
    return /^[a-zA-Z]/.test(actualLine) ? actualLine : `L${actualLine}`;
  }, [actualLine]);

  const actualLineColour = useMemo(() => {
    const actualColour = colour?.startsWith("#") ? colour : `#${colour}`;
    return colour ? actualColour : `var(--line-${formattedLine.toLowerCase()})`;
  }, [formattedLine]);
  const actualTextColour = useMemo(() => {
    const actualTextColour = textColour?.startsWith("#")
      ? textColour
      : `#${textColour}`;
    return textColour
      ? actualTextColour
      : `var(--line-${formattedLine.toLowerCase()}-text, #000000)`;
  }, [formattedLine]);

  return (
    <span
      className={`line-icon-${mode}`}
      style={
        {
          "--line-colour": actualLineColour,
          "--line-text-colour": actualTextColour,
        } as React.CSSProperties
      }
    >
      {actualLine}
    </span>
  );
};

export default LineIcon;
