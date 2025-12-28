import React from "react";
import { Link } from "react-router";
import StopDataProvider, { type Stop } from "../data/StopDataProvider";
import LineIcon from "./LineIcon";

interface StopGalleryItemProps {
  stop: Stop;
}

const StopGalleryItem: React.FC<StopGalleryItemProps> = ({ stop }) => {
  return (
    <div className="flex-[0_0_90%] max-w-80 snap-start snap-always md:flex-[0_0_320px] lg:flex-[0_0_340px]">
      <Link
        className="
          block p-3 min-h-[100px]
          bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/80
          border-2 border-gray-200 dark:border-gray-700 rounded-xl
          no-underline text-gray-900 dark:text-gray-100
          hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm
          transition-all duration-200
        "
        to={`/stops/${stop.stopId}`}
      >
        <div className="flex items-center gap-2 mb-1">
          {stop.favourite && (
            <span className="text-yellow-500 text-base">★</span>
          )}
          <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
            ({stop.stopCode || stop.stopId})
          </span>
        </div>
        <div
          className="text-[0.95rem] font-semibold mb-2 leading-snug line-clamp-2 min-h-[2.5em]"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {StopDataProvider.getDisplayName(stop)}
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          {stop.lines?.slice(0, 5).map((lineObj) => (
            <LineIcon
              key={lineObj.line}
              line={lineObj.line}
              colour={lineObj.colour}
              textColour={lineObj.textColour}
            />
          ))}
          {stop.lines && stop.lines.length > 5 && (
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
              +{stop.lines.length - 5}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
};

export default StopGalleryItem;
