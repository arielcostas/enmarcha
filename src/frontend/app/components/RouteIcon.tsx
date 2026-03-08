import React, { useMemo } from "react";
import { formatHex } from "~/utils/colours";
import "./RouteIcon.css";

interface RouteIconProps {
  line: string;
  mode?: "rounded" | "pill" | "default";
  colour: string;
  textColour: string;
}

const RouteIcon: React.FC<RouteIconProps> = ({
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
    return formatHex(colour, true);
  }, [colour]);
  const actualTextColour = useMemo(() => {
    return formatHex(textColour, true);
  }, [textColour]);

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

export default RouteIcon;
