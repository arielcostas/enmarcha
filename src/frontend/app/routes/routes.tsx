import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { fetchRoutes } from "~/api/transit";
import RouteIcon from "~/components/RouteIcon";
import { usePageTitle } from "~/contexts/PageTitleContext";
import { useFavorites } from "~/hooks/useFavorites";
import { useSessionState } from "~/hooks/useSessionState";
import "../tailwind-full.css";

// Feeds that contain many agencies and need a two-level (Feed → Agency → Routes)
// accordion. Add new multi-agency feeds here when ready.
const MULTI_AGENCY_FEEDS: Record<string, { displayName: string }> = {
  xunta: { displayName: "Transporte Público de Galicia (Xunta)" },
};

export default function RoutesPage() {
  const { t } = useTranslation();
  usePageTitle(t("navbar.routes", "Rutas"));
  const [searchQuery, setSearchQuery] = useSessionState<string>(
    "routes_searchQuery",
    ""
  );
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useSessionState(
    "routes_isFavoritesExpanded",
    true
  );
  const { isFavorite: isFavoriteRoute } = useFavorites("favouriteRoutes");
  const { toggleFavorite: toggleFavoriteAgency, isFavorite: isFavoriteAgency } =
    useFavorites("favouriteAgencies");

  const [expandedAgencies, setExpandedAgencies] = useSessionState<
    Record<string, boolean>
  >("routes_expandedAgencies", {});

  const [expandedFeeds, setExpandedFeeds] = useSessionState<
    Record<string, boolean>
  >("routes_expandedFeeds", {});

  const [expandedSubAgencies, setExpandedSubAgencies] = useSessionState<
    Record<string, boolean>
  >("routes_expandedSubAgencies", {});

  const toggleAgencyExpanded = (agency: string) => {
    setExpandedAgencies((prev) => ({ ...prev, [agency]: !prev[agency] }));
  };

  const toggleFeedExpanded = (feedId: string) => {
    setExpandedFeeds((prev) => ({ ...prev, [feedId]: !prev[feedId] }));
  };

  const toggleSubAgencyExpanded = (key: string) => {
    setExpandedSubAgencies((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Each entry is either a plain feed ID ("tussa") — which includes all agencies
  // in that feed — or a "feedId:agencyId" pair ("renfe:cercanias") to restrict
  // results to a single agency within a feed.
  // Multi-agency feeds (listed in MULTI_AGENCY_FEEDS) are fetched separately.
  const mainFeeds = [
    "vitrasa",
    "tranvias",
    "tussa",
    "ourense",
    "lugo",
    "shuttle",
    "renfe:1071VC",
  ];

  const { data: routes, isLoading } = useQuery({
    queryKey: ["routes", "main"],
    queryFn: () => fetchRoutes(mainFeeds),
  });

  const { data: xuntaRoutes, isLoading: isLoadingXunta } = useQuery({
    queryKey: ["routes", "xunta"],
    queryFn: () => fetchRoutes(["xunta"]),
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
      const indexA = mainFeeds.indexOf(feedIdA);
      const indexB = mainFeeds.indexOf(feedIdB);
      if (indexA === -1 && indexB === -1) {
        return a.localeCompare(b);
      }
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [routesByAgency, mainFeeds, isFavoriteAgency]);

  // Group multi-agency feed routes by agency name, filtered by search query.
  const multiAgencyGroups = useMemo(() => {
    const result: Record<
      string,
      { displayName: string; agenciesMap: Record<string, typeof xuntaRoutes> }
    > = {};

    const xuntaFiltered = xuntaRoutes?.filter(
      (route) =>
        !searchQuery ||
        route.shortName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        route.longName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (xuntaFiltered && xuntaFiltered.length > 0) {
      const agenciesMap: Record<string, typeof xuntaFiltered> = {};
      for (const route of xuntaFiltered) {
        const id = route.agencyId ?? route.agencyName ?? "otros";
        if (!agenciesMap[id]) agenciesMap[id] = [];
        agenciesMap[id].push(route);
      }
      result["xunta"] = {
        displayName: MULTI_AGENCY_FEEDS.xunta.displayName,
        agenciesMap,
      };
    }

    return result;
  }, [xuntaRoutes, searchQuery]);

  const allRoutes = useMemo(
    () => [...(routes ?? []), ...(xuntaRoutes ?? [])],
    [routes, xuntaRoutes]
  );

  const favoriteRoutes = useMemo(() => {
    return (
      allRoutes.filter(
        (route) =>
          isFavoriteRoute(route.id) &&
          (!searchQuery ||
            route.shortName
              ?.toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            route.longName?.toLowerCase().includes(searchQuery.toLowerCase()))
      ) || []
    );
  }, [allRoutes, searchQuery, isFavoriteRoute]);

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
                      className="flex items-center gap-3 rounded-lg px-3 py-1 hover:bg-background"
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

        {/* Multi-agency feeds: Feed accordion → Agency sub-accordion → Routes */}
        {Object.entries(multiAgencyGroups).map(([feedId, feedGroup]) => {
          const isFeedExpanded = searchQuery
            ? true
            : (expandedFeeds[feedId] ?? false);
          const totalRouteCount = Object.values(feedGroup.agenciesMap).reduce(
            (sum, r) => sum + (r?.length ?? 0),
            0
          );

          return (
            <div
              key={feedId}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              <button
                type="button"
                onClick={() => toggleFeedExpanded(feedId)}
                className={`flex w-full items-center gap-3 px-4 py-4 text-left ${
                  isFeedExpanded ? "border-b border-border" : ""
                }`}
              >
                <div className="text-muted">
                  {isFeedExpanded ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </div>
                <h2 className="flex-1 text-base font-semibold text-text">
                  {feedGroup.displayName}
                </h2>
                {isLoadingXunta ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                ) : (
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">
                    {totalRouteCount}
                  </span>
                )}
              </button>

              {isFeedExpanded && (
                <div className="space-y-0">
                  {isLoadingXunta ? (
                    <div className="flex justify-center py-6">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  ) : (
                    Object.entries(feedGroup.agenciesMap)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([agencyId, agencyRoutes]) => {
                        const agencyName =
                          agencyRoutes?.[0]?.agencyName ?? agencyId;
                        const agencyCode = agencyId.includes(":")
                          ? agencyId.split(":")[1]
                          : agencyId;
                        const isFav = isFavoriteAgency(agencyId);
                        const isSubExpanded = searchQuery
                          ? true
                          : (expandedSubAgencies[agencyId] ?? false);

                        return (
                          <div
                            key={agencyId}
                            className="border-t border-border first:border-t-0"
                          >
                            <div
                              className={`flex items-center justify-between pl-8 pr-4 py-2.5 select-none ${
                                isSubExpanded ? "border-b border-border" : ""
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  toggleSubAgencyExpanded(agencyId)
                                }
                                className="flex flex-1 items-center gap-3 text-left"
                              >
                                <div className="text-muted">
                                  {isSubExpanded ? (
                                    <ChevronDown size={16} />
                                  ) : (
                                    <ChevronRight size={16} />
                                  )}
                                </div>
                                <span className="text-sm font-medium text-text">
                                  {agencyName}
                                </span>
                                <span className="text-xs text-muted font-mono">
                                  {agencyCode}
                                </span>
                                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">
                                  {agencyRoutes?.length ?? 0}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleFavoriteAgency(agencyId)}
                                className={`rounded-full p-1.5 transition-colors ${
                                  isFav
                                    ? "text-yellow-500"
                                    : "text-muted hover:text-yellow-500"
                                }`}
                                aria-label={t(
                                  "routes.toggle_favorite_agency",
                                  "Alternar agencia favorita"
                                )}
                              >
                                <Star
                                  size={14}
                                  className={isFav ? "fill-current" : ""}
                                />
                              </button>
                            </div>

                            {isSubExpanded && (
                              <div className="space-y-1 px-3 py-2">
                                {agencyRoutes?.map((route) => (
                                  <div key={route.id} className="rounded-lg">
                                    <Link
                                      to={`/routes/${route.id}`}
                                      className="flex items-center gap-3 rounded-lg px-3 py-1 hover:bg-background"
                                    >
                                      <RouteIcon
                                        line={route.shortName ?? "?"}
                                        mode="pill"
                                        colour={route.color ?? "#6b7280"}
                                        textColour={
                                          route.textColor ?? "#ffffff"
                                        }
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
                      })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
