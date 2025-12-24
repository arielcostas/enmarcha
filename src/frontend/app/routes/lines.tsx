import { useTranslation } from "react-i18next";
import LineIcon from "~/components/LineIcon";
import { usePageTitle } from "~/contexts/PageTitleContext";
import { VIGO_LINES } from "~/data/LinesData";
import "../tailwind-full.css";

export default function LinesPage() {
  const { t } = useTranslation();
  usePageTitle(t("navbar.lines", "Líneas"));

  return (
    <div className="container mx-auto px-4 py-6">
      <p className="mb-6 text-gray-700 dark:text-gray-300">
        {t(
          "lines.description",
          "A continuación se muestra una lista de las líneas de autobús urbano de Vigo con sus respectivas rutas y enlaces a los horarios oficiales."
        )}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {VIGO_LINES.map((line) => (
          <a
            key={line.lineNumber}
            href={line.scheduleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-surface rounded-lg shadow hover:shadow-lg transition-shadow border border-border"
          >
            <LineIcon line={line.lineNumber} mode="rounded" />
            <div className="flex-1 min-w-0">
              <p className="text-sm md:text-md font-semibold text-text">
                {line.routeName}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
