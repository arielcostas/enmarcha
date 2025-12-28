import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/map", "routes/map.tsx"),
  route("/routes", "routes/routes.tsx"),
  route("/routes/:id", "routes/routes-$id.tsx"),
  route("/stops", "routes/stops.tsx"),
  route("/stops/:id", "routes/stops-$id.tsx"),
  route("/settings", "routes/settings.tsx"),
  route("/about", "routes/about.tsx"),
  route("/favourites", "routes/favourites.tsx"),
  route("/planner", "routes/planner.tsx"),
] satisfies RouteConfig;
