import { useTranslation } from "react-i18next";
import { usePageTitle } from "~/contexts/PageTitleContext";
import "../tailwind-full.css";

export default function About() {
  const { t } = useTranslation();
  usePageTitle(t("about.title", "Acerca de"));

  return (
    <div className="page-container max-w-3xl mx-auto">
      <div className="mb-8">
        <p className="text-lg leading-relaxed opacity-90">
          {t("about.description")}
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 border-b border-[--border-color] pb-2">
          {t("about.data_sources_title")}
        </h2>
        <p className="mb-4 opacity-80">{t("about.data_sources_intro")}</p>
        <ul className="space-y-3 ml-4">
          <li className="flex flex-col sm:flex-row sm:items-start gap-1">
            <strong className="text-[--text-color] min-w-fit">
              {t("about.data_gtfs")}:
            </strong>
            <a
              href="https://datos-ckan.vigo.org/dataset/gtfs-vitrasa"
              className="text-blue-600 dark:text-blue-400 hover:underline hover:brightness-110 transition-all"
              rel="nofollow noreferrer noopener"
              target="_blank"
            >
              {t("about.data_gtfs_source")}
            </a>
          </li>
          <li className="flex flex-col sm:flex-row sm:items-start gap-1">
            <strong className="text-[--text-color] min-w-fit">
              {t("about.data_realtime")}:
            </strong>
            <span className="opacity-80">
              {t("about.data_realtime_source")}
            </span>
          </li>
          <li className="flex flex-col sm:flex-row sm:items-start gap-1">
            <strong className="text-[--text-color] min-w-fit">
              {t("about.data_traffic")}:
            </strong>
            <a
              href="https://datos-ckan.vigo.org/dataset/t-estado-trafico"
              className="text-blue-600 dark:text-blue-400 hover:underline hover:brightness-110 transition-all"
              rel="nofollow noreferrer noopener"
              target="_blank"
            >
              {t("about.data_traffic_source")}
            </a>
          </li>
          <li className="flex flex-col sm:flex-row sm:items-start gap-1">
            <strong className="text-[--text-color] min-w-fit">
              {t("about.data_lines")}:
            </strong>
            <a
              href="https://vitrasa.es"
              className="text-blue-600 dark:text-blue-400 hover:underline hover:brightness-110 transition-all"
              rel="nofollow noreferrer noopener"
              target="_blank"
            >
              vitrasa.es
            </a>
          </li>
        </ul>

        <div className="mt-6 p-4 bg-[--card-background] rounded-lg border border-[--border-color]">
          <p className="flex flex-col sm:flex-row sm:items-start gap-1">
            <strong className="text-[--text-color] min-w-fit">
              {t("about.map_tiles")}:
            </strong>
            <span>
              <a
                href="https://openfreemap.org"
                className="text-blue-600 dark:text-blue-400 hover:underline hover:brightness-110 transition-all"
                rel="nofollow noreferrer noopener"
                target="_blank"
              >
                OpenFreeMap
              </a>{" "}
              <span className="opacity-70 text-sm">
                {t("about.map_themes")}
              </span>
            </span>
          </p>
        </div>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm leading-relaxed">{t("about.thanks_council")}</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 border-b border-[--border-color] pb-2">
          {t("about.credits")}
        </h2>
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-1">
            <span className="opacity-80">{t("about.developed_by")}</span>
            <a
              href="https://www.costas.dev"
              className="text-blue-600 dark:text-blue-400 hover:underline hover:brightness-110 transition-all font-medium"
              rel="nofollow noreferrer noopener"
              target="_blank"
            >
              Ariel Costas
            </a>
          </p>
          <p className="flex flex-wrap items-center gap-1">
            <span className="opacity-80">{t("about.open_source")}</span>
            <a
              href="https://github.com/arielcostas/enmarcha"
              className="text-blue-600 dark:text-blue-400 hover:underline hover:brightness-110 transition-all font-medium inline-flex items-center gap-1"
              rel="nofollow noreferrer noopener"
              target="_blank"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              GitHub
            </a>
          </p>
          <p className="flex flex-wrap items-center gap-1">
            <span className="opacity-80">{t("about.license_prefix")}</span>
            <a
              href="https://opendefinition.org/licenses/odc-by/"
              className="text-blue-600 dark:text-blue-400 hover:underline hover:brightness-110 transition-all"
              rel="nofollow noreferrer noopener"
              target="_blank"
            >
              Open Data Commons Attribution License
            </a>
          </p>
        </div>
      </section>

      <div className="text-center text-sm text-[--text-secondary-color] opacity-70 mb-4">
        <small>Version: {__COMMIT_HASH__}</small>
      </div>
    </div>
  );
}
