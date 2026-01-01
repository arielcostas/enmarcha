import { AlertCircle, CheckCircle2, ExternalLink, Smartphone, X } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "react-modal-sheet";

interface EnMarchaAnnouncementProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnMarchaAnnouncement: React.FC<EnMarchaAnnouncementProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();

  const features = [
    "feature_planner",
    "feature_realtime",
    "feature_operators",
    "feature_ui",
    "feature_more",
  ];

  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content">
      <Sheet.Container className="bg-white! dark:bg-black! !rounded-t-[20px]">
        <Sheet.Header className="bg-white! dark:bg-black! !rounded-t-[20px]" />
        <Sheet.Content>
          <div className="p-6 pb-10 flex flex-col gap-6 overflow-y-auto max-h-[85vh] text-slate-900 dark:text-slate-100">
            <div className="flex justify-between items-start">
              <h2 className="text-2xl font-bold tracking-tight">
                {t("enmarcha_announcement.title")}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={t("enmarcha_announcement.close")}
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 flex gap-3 items-center">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {t("enmarcha_announcement.discontinuation_notice")}
                </p>
              </div>

              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {t("enmarcha_announcement.description")}
              </p>

              <div className="space-y-3 py-2">
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("enmarcha_announcement.features_title")}
                </h3>
                <ul className="space-y-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex gap-3 items-start text-sm">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <span>{t(`enmarcha_announcement.${feature}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href="https://enmarcha.app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-[0.98]"
              >
                {t("enmarcha_announcement.link_text")}
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-slate-400" />
                <h3 className="font-bold text-lg">
                  {t("enmarcha_announcement.install_title")}
                </h3>
              </div>

              <div className="grid gap-3">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">Android</h4>
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <p>{t("enmarcha_announcement.android_chrome")}</p>
                    <p>{t("enmarcha_announcement.android_firefox")}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">iOS</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t("enmarcha_announcement.ios_safari")}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2 text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              {t("enmarcha_announcement.close")}
            </button>
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
};
