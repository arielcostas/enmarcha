import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { fetchRoutes } from "~/api/transit";
import LineIcon from "~/components/LineIcon";
import { usePageTitle } from "~/contexts/PageTitleContext";
import "../tailwind-full.css";

export default function RoutesPage() {
  const { t } = useTranslation();
  usePageTitle(t("navbar.routes", "Rutas"));
  const [searchQuery, setSearchQuery] = useState("");

  const { data: routes, isLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: () => fetchRoutes(["tussa", "vitrasa", "tranvias", "feve"]),
  });

  const filteredRoutes = routes?.filter(
    (route) =>
      route.shortName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.longName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const routesByAgency = filteredRoutes?.reduce(
    (acc, route) => {
      const agency = route.agencyName || t("routes.unknown_agency", "Otros");
      if (!acc[agency]) acc[agency] = [];
      acc[agency].push(route);
      return acc;
    },
    {} as Record<string, typeof routes>
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <input
          type="text"
          placeholder={t("routes.search_placeholder", "Buscar rutas...")}
          className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary shadow-sm placeholder-gray-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      <div className="space-y-8">
        {routesByAgency &&
          Object.entries(routesByAgency).map(([agency, agencyRoutes]) => (
            <div key={agency}>
              <h2 className="text-xl font-bold text-text mb-4 border-b border-border pb-2">
                {agency}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agencyRoutes.map((route) => (
                  <Link
                    key={route.id}
                    to={`/routes/${route.id}`}
                    className="flex items-center gap-3 p-4 bg-surface rounded-lg shadow hover:shadow-lg transition-shadow border border-border"
                  >
                    <LineIcon
                      line={route.shortName ?? "?"}
                      mode="pill"
                      colour={route.color ?? undefined}
                      textColour={route.textColor ?? undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm md:text-md font-semibold text-text">
                        {route.longName}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
