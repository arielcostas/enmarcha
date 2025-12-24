import { AlertTriangle, Clock, LocateIcon } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "react-modal-sheet";

interface StopHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StopHelpModal: React.FC<StopHelpModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content">
      <Sheet.Container className="bg-white! dark:bg-black! !rounded-t-[20px]">
        <Sheet.Header className="bg-white! dark:bg-black! !rounded-t-[20px]" />
        <Sheet.Content>
          <div className="p-6 pb-10 flex flex-col gap-8 overflow-y-auto max-h-[80vh] text-slate-900 dark:text-slate-100">
            <div>
              <h2 className="text-xl font-bold mb-4">{t("stop_help.title")}</h2>

              <div className="space-y-5">
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-6 h-6 text-green-700 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-700 dark:text-green-400 text-base">
                      {t("stop_help.realtime_ok")}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t("stop_help.realtime_ok_desc")}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-orange-600/20 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-6 h-6 text-orange-700 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-orange-700 dark:text-orange-400 text-base">
                      {t("stop_help.realtime_warning")}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t("stop_help.realtime_warning_desc")}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-blue-900/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-6 h-6 text-blue-900 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-400 text-base">
                      {t("stop_help.scheduled")}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t("stop_help.scheduled_desc")}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                    <LocateIcon className="w-6 h-6 text-slate-700 dark:text-slate-300" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                      {t("stop_help.gps")}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t("stop_help.gps_desc")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold mb-4">
                {t("stop_help.punctuality")}
              </h2>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-600/20 dark:bg-green-600/30 text-green-700 dark:text-green-300 shrink-0">
                    {t("stop_help.punctuality_ontime_label", "En hora")}
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t("stop_help.punctuality_ontime")}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-400/20 dark:bg-blue-600/30 text-blue-700 dark:text-blue-300 shrink-0">
                    {t("stop_help.punctuality_early_label", "Adelanto")}
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t("stop_help.punctuality_early")}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-600/20 dark:bg-yellow-600/30 text-amber-700 dark:text-yellow-300 shrink-0">
                    {t("stop_help.punctuality_late_label", "Retraso")}
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t("stop_help.punctuality_late")}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold mb-4">
                {t("stop_help.gps_quality")}
              </h2>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium shrink-0">
                    {t("stop_help.gps_reliable_label", "GPS fiable")}
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t("stop_help.gps_reliable")}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium shrink-0">
                    {t("stop_help.gps_imprecise_label", "GPS impreciso")}
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t("stop_help.gps_imprecise")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
};
