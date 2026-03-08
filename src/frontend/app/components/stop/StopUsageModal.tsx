import { Sheet } from "react-modal-sheet";
import type { BusStopUsagePoint } from "~/api/schema";
import { StopUsageChart } from "./StopUsageChart";

interface StopUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  usage: BusStopUsagePoint[];
}

export const StopUsageModal = ({
  isOpen,
  onClose,
  usage,
}: StopUsageModalProps) => {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content">
      <Sheet.Container className="bg-white! dark:bg-black! !rounded-t-[20px]">
        <Sheet.Header className="bg-white! dark:bg-black! !rounded-t-[20px]" />
        <Sheet.Content className="p-6 pb-12">
          <StopUsageChart usage={usage} />
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
};
