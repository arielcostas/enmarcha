import { Clock } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { fetchArrivals } from "../api/arrivals";
import { type Arrival } from "../api/schema";
import StopDataProvider, { type Stop } from "../data/StopDataProvider";
import RouteIcon from "./RouteIcon";

interface StopItemProps {
  stop: Stop;
  showArrivals?: boolean;
}

const StopItem: React.FC<StopItemProps> = ({ stop, showArrivals }) => {
  const { t } = useTranslation();
  const [arrivals, setArrivals] = useState<Arrival[] | null>(null);

  useEffect(() => {
    let mounted = true;
    if (showArrivals) {
      fetchArrivals(stop.stopId, true)
        .then((res) => {
          if (mounted) {
            setArrivals(res.arrivals.slice(0, 3));
          }
        })
        .catch(console.error);
    }
    return () => {
      mounted = false;
    };
  }, [showArrivals, stop.stopId]);

  return (
    <li>
      <Link
        to={`/stops/${stop.stopId}`}
        className="flex items-center gap-x-4 gap-y-3 rounded-xl p-3 transition-all bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 active:scale-[0.98] cursor-pointer"
      >
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex justify-between items-start gap-2">
            <span className="text-base font-bold overflow-hidden text-ellipsis line-clamp-2 leading-tight text-slate-900 dark:text-slate-100">
              {stop.favourite && (
                <span className="text-yellow-500 mr-2">★</span>
              )}
              {StopDataProvider.getDisplayName(stop)}
            </span>
          </div>

          <div className="text-xs flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono uppercase">
            <span className="px-1.5 py-0.5 rounded flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-none">
              {stop.stopId.split(":")[0]}
            </span>
            <span>
              {stop.stopCode || stop.stopId.split(":")[1] || stop.stopId}
            </span>
          </div>

          {stop.lines && stop.lines.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {stop.lines.map((lineObj) => (
                <RouteIcon
                  key={lineObj.line}
                  line={lineObj.line}
                  colour={lineObj.colour}
                  textColour={lineObj.textColour}
                />
              ))}
            </div>
          )}

          {showArrivals && arrivals && arrivals.length > 0 && (
            <div className="flex flex-col gap-1 mt-2 p-2 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 mb-1 opacity-70">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {t("estimates.next_arrivals", "Próximas llegadas")}
                </span>
              </div>
              {arrivals.map((arr, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="shrink-0">
                    <RouteIcon
                      line={arr.route.shortName}
                      colour={arr.route.colour}
                      textColour={arr.route.textColour}
                    />
                  </div>
                  <span className="flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                    {arr.headsign.destination}
                  </span>
                  <span
                    className={`text-xs pr-1 font-bold ${
                      arr.estimate.precision === "confident"
                        ? "text-green-600 dark:text-green-500"
                        : arr.estimate.precision === "unsure"
                          ? "text-orange-600 dark:text-orange-500"
                          : arr.estimate.precision === "past"
                            ? "text-gray-500 line-through"
                            : "text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {arr.estimate.minutes}&apos;
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
};

export default StopItem;
