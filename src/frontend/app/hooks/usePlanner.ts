import { usePlannerContext } from "../contexts/PlannerContext";

export function usePlanner(options: { autoLoad?: boolean } = {}) {
  return usePlannerContext();
}
