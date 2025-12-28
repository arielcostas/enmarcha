import {
  isRouteErrorResponse,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
} from "react-router";

import "@fontsource-variable/outfit";
import type { Route } from "./+types/root";
import "./root.css";

//#region Maplibre setup
import maplibregl from "maplibre-gl";
import "maplibre-theme/icons.default.css";
import "maplibre-theme/modern.css";
import { Protocol } from "pmtiles";
import { AppProvider } from "./AppContext";
const pmtiles = new Protocol();
maplibregl.addProtocol("pmtiles", pmtiles.tile);
//#endregion

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlannerProvider } from "./contexts/PlannerContext";
import "./i18n";

const queryClient = new QueryClient();

export const links: Route.LinksFunction = () => [];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        <link rel="icon" type="image/png" href="/icon-round.png" />
        <link rel="apple-touch-icon" href="/icon-round.png" sizes="256x256" />

        <meta name="theme-color" content="#F7F7FF" />
        <link rel="canonical" href="https://enmarcha.app/" />

        <meta
          name="description"
          content="Aplicación web para encontrar paradas y tiempos de llegada de los autobuses urbanos"
        />
        <meta
          name="keywords"
          content="autobús, urbano, parada, tiempo, llegada, transporte, público, España"
        />
        <meta name="author" content="Ariel Costas Guerrero" />

        <meta property="og:title" content="EnMarcha" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://enmarcha.app/" />
        <meta
          property="og:image"
          content="https://enmarcha.app/icon-round.png"
        />
        <meta
          property="og:description"
          content="Aplicación web para encontrar paradas y tiempos de llegada de los autobuses urbanos"
        />

        <link rel="manifest" href="/manifest.webmanifest" />

        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />

        <title>Busurbano</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

import { AppShell } from "./components/layout/AppShell";

export default function App() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/pwa-worker.js").catch((error) => {
      console.error("Error registering SW:", error);
    });
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <PlannerProvider>
          <AppShell />
        </PlannerProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main>
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
