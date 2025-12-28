import React from "react";
import { Link } from "react-router";
import StopDataProvider, { type Stop } from "../data/StopDataProvider";
import LineIcon from "./LineIcon";

interface StopItemProps {
  stop: Stop;
}

const StopItem: React.FC<StopItemProps> = ({ stop }) => {
  return (
    <li className="pb-3 border-b border-gray-200 dark:border-gray-700 md:border md:border-gray-300 dark:md:border-gray-700 md:rounded-lg md:p-3 md:pb-3">
      <Link
        className="block text-gray-900 dark:text-gray-100 no-underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
        to={`/stops/${stop.stopId}`}
      >
        <div className="flex justify-between items-baseline">
          <span className="font-semibold">
            {stop.favourite && <span className="text-yellow-500 mr-1">★</span>}
            {StopDataProvider.getDisplayName(stop)}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
            ({stop.stopCode || stop.stopId})
          </span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {stop.lines?.map((lineObj) => (
            <LineIcon
              key={lineObj.line}
              line={lineObj.line}
              colour={lineObj.colour}
              textColour={lineObj.textColour}
            />
          ))}
        </div>
      </Link>
    </li>
  );
};

export default StopItem;
