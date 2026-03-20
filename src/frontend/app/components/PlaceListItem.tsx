import { Building2, BusFront, MapPin } from "lucide-react";
import type { PlannerSearchResult } from "~/data/PlannerApi";

function getIcon(layer?: string) {
  switch ((layer || "").toLowerCase()) {
    case "stop":
      return (
        <BusFront className="w-4 h-4 text-slate-600 dark:text-slate-400" />
      );
    case "venue":
      return (
        <Building2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
      );
    case "address":
    case "street":
    case "favourite-stop":
    case "current-location":
    default:
      return <MapPin className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
  }
}

export default function PlaceListItem({
  place,
  onClick,
}: {
  place: PlannerSearchResult;
  onClick: (place: PlannerSearchResult) => void;
}) {
  return (
    <li className="border-t border-slate-100 dark:border-slate-700">
      <button
        type="button"
        className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-200"
        onClick={() => onClick(place)}
      >
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4">
            {getIcon(place.layer)}
          </span>
          <span>{place.name}</span>
        </div>
        {place.label && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {place.label}
          </div>
        )}
      </button>
    </li>
  );
}
