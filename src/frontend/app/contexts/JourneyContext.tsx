import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface ActiveJourney {
  tripId: string;
  stopId: string;
  stopName: string;
  routeShortName: string;
  routeColour: string;
  routeTextColour: string;
  headsignDestination: string | null;
  /** Minutes remaining when tracking was started (for display context) */
  initialMinutes: number;
  /** Send notification when this many minutes remain (default: 2) */
  notifyAtMinutes: number;
  /** Whether the "approaching" notification has already been sent */
  hasNotified: boolean;
}

interface JourneyContextValue {
  activeJourney: ActiveJourney | null;
  startJourney: (journey: Omit<ActiveJourney, "hasNotified">) => void;
  stopJourney: () => void;
  markNotified: () => void;
}

const JourneyContext = createContext<JourneyContextValue | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [activeJourney, setActiveJourney] = useState<ActiveJourney | null>(
    null
  );
  const notificationRef = useRef<Notification | null>(null);

  const startJourney = useCallback(
    (journey: Omit<ActiveJourney, "hasNotified">) => {
      // Close any existing notification
      if (notificationRef.current) {
        notificationRef.current.close();
        notificationRef.current = null;
      }
      setActiveJourney({ ...journey, hasNotified: false });
    },
    []
  );

  const stopJourney = useCallback(() => {
    if (notificationRef.current) {
      notificationRef.current.close();
      notificationRef.current = null;
    }
    setActiveJourney(null);
  }, []);

  const markNotified = useCallback(() => {
    setActiveJourney((prev) => (prev ? { ...prev, hasNotified: true } : null));
  }, []);

  return (
    <JourneyContext.Provider
      value={{ activeJourney, startJourney, stopJourney, markNotified }}
    >
      {children}
    </JourneyContext.Provider>
  );
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) {
    throw new Error("useJourney must be used within a JourneyProvider");
  }
  return ctx;
}
