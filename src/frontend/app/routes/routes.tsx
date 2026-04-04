import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { fetchRoutes } from "~/api/transit";
import RouteIcon from "~/components/RouteIcon";
import { usePageTitle } from "~/contexts/PageTitleContext";
import { useFavorites } from "~/hooks/useFavorites";
import "../tailwind-full.css";

export default function RoutesPage() {
  const { t } = useTranslation();
  usePageTitle(t("navbar.routes", "Rutas"));
  const [searchQuery, setSearchQuery] = useState("");
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(true);
  const { isFavorite: isFavoriteRoute } = useFavorites("favouriteRoutes");
  const { toggleFavorite: toggleFavoriteAgency, isFavorite: isFavoriteAgency } =
    useFavorites("favouriteAgencies");

  const [expandedAgencies, setExpandedAgencies] = useState<
    Record<string, boolean>
  >({});

  const toggleAgencyExpanded = (agency: string) => {
    setExpandedAgencies((prev) => ({ ...prev, [agency]: !prev[agency] }));
  };

  const orderedAgencies = [
    "vitrasa",
    "tranvias",
    "tussa",
    "ourense",
    "lugo",
    "shuttle",
  ];

  const { data: routes, isLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: () => fetchRoutes(orderedAgencies),
  });

  const filteredRoutes = useMemo(() => {
    return routes?.filter(
      (route) =>
        route.shortName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        route.longName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [routes, searchQuery]);

  const routesByAgency = useMemo(() => {
    return filteredRoutes?.reduce(
      (acc, route) => {
        const agency = route.agencyName || t("routes.unknown_agency", "Otros");
        if (!acc[agency]) acc[agency] = [];
        acc[agency].push(route);
        return acc;
      },
      {} as Record<string, typeof routes>
    );
  }, [filteredRoutes, t]);

  const sortedAgencyEntries = useMemo(() => {
    if (!routesByAgency) return [];
    return Object.entries(routesByAgency).sort(([a, routesA], [b, routesB]) => {
      // Use the agency's own gtfsId (feedId:agencyId) as the stable key — this
      // matches the "agency#feedId:agencyId" alert selector format and correctly
      // handles feeds that contain multiple agencies.
      const agencyIdA =
        routesA?.[0]?.agencyId ??
        routesA?.[0]?.id.split(":")[0] ??
        a.toLowerCase();
      const agencyIdB =
        routesB?.[0]?.agencyId ??
        routesB?.[0]?.id.split(":")[0] ??
        b.toLowerCase();
      const feedIdA = agencyIdA.split(":")[0];
      const feedIdB = agencyIdB.split(":")[0];

      // First, sort by favorite status
      const isFavA = isFavoriteAgency(agencyIdA);
      const isFavB = isFavoriteAgency(agencyIdB);
      if (isFavA && !isFavB) return -1;
      if (!isFavA && isFavB) return 1;

      // Then by fixed order
      const indexA = orderedAgencies.indexOf(feedIdA);
      const indexB = orderedAgencies.indexOf(feedIdB);
      if (indexA === -1 && indexB === -1) {
        return a.localeCompare(b);
      }
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [routesByAgency, orderedAgencies, isFavoriteAgency]);

  const favoriteRoutes = useMemo(() => {
    return filteredRoutes?.filter((route) => isFavoriteRoute(route.id)) || [];
  }, [filteredRoutes, isFavoriteRoute]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <input
          type="text"
          placeholder={t("routes.search_placeholder", "Buscar rutas...")}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      <div className="space-y-3">
        {favoriteRoutes.length > 0 && !searchQuery && (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <button
              type="button"
              onClick={() => setIsFavoritesExpanded((prev) => !prev)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left ${isFavoritesExpanded ? "border-b border-border" : ""}`}
            >
              <div className="text-muted">
                {isFavoritesExpanded ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </div>
              <Star size={16} className="fill-yellow-500 text-yellow-500" />
              <h2 className="flex-1 text-base font-semibold text-text">
                {t("routes.favorites", "Favoritas")}
              </h2>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">
                {favoriteRoutes.length}
              </span>
            </button>

            {isFavoritesExpanded && (
              <div className="space-y-1 px-3 py-2">
                {favoriteRoutes.map((route) => (
                  <div key={`fav-${route.id}`} className="rounded-lg">
                    <Link
                      to={`/routes/${route.id}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-background"
                    >
                      <RouteIcon
                        line={route.shortName ?? "?"}
                        mode="pill"
                        colour={route.color ?? "#6b7280"}
                        textColour={route.textColor ?? "#ffffff"}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-text">
                          {route.longName}
                        </p>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {sortedAgencyEntries.map(([agency, agencyRoutes]) => {
          // Use the agency's own gtfsId (feedId:agencyId) as the stable favourite key.
          const agencyId =
            agencyRoutes?.[0]?.agencyId ??
            agencyRoutes?.[0]?.id.split(":")[0] ??
            agency.toLowerCase();
          const isFav = isFavoriteAgency(agencyId);
          const isExpanded = searchQuery
            ? true
            : (expandedAgencies[agency] ?? isFav);

          return (
            <div
              key={agency}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              <div
                className={`flex items-center justify-between px-4 py-3 select-none ${isExpanded ? "border-b border-border" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggleAgencyExpanded(agency)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <div className="text-muted">
                    {isExpanded ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </div>
                  <h2 className="text-base font-semibold text-text">
                    {agency}
                  </h2>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">
                    {agencyRoutes.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavoriteAgency(agencyId)}
                  className={`rounded-full p-2 transition-colors ${
                    isFav
                      ? "text-yellow-500"
                      : "text-muted hover:text-yellow-500"
                  }`}
                  aria-label={t(
                    "routes.toggle_favorite_agency",
                    "Alternar agencia favorita"
                  )}
                >
                  <Star size={16} className={isFav ? "fill-current" : ""} />
                </button>
              </div>

              {isExpanded && (
                <div className="space-y-1 px-3 py-2">
                  {agencyRoutes.map((route) => (
                    <div key={route.id} className="rounded-lg">
                      <Link
                        to={`/routes/${route.id}`}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-background"
                      >
                        <RouteIcon
                          line={route.shortName ?? "?"}
                          mode="pill"
                          colour={route.color ?? "#6b7280"}
                          textColour={route.textColor ?? "#ffffff"}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-text">
                            {route.longName}
                          </p>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
