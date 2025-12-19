export interface SpecialPlace {
  name: string;
  type: "stop" | "address";
  stopId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

const STORAGE_KEY_HOME = `specialPlace_home`;
const STORAGE_KEY_WORK = `specialPlace_work`;

function getHome(): SpecialPlace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HOME);
    if (raw) {
      return JSON.parse(raw) as SpecialPlace;
    }
  } catch (error) {
    console.error("Error reading home location:", error);
  }
  return null;
}

function setHome(place: SpecialPlace): void {
  try {
    localStorage.setItem(STORAGE_KEY_HOME, JSON.stringify(place));
  } catch (error) {
    console.error("Error saving home location:", error);
  }
}

function removeHome(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_HOME);
  } catch (error) {
    console.error("Error removing home location:", error);
  }
}

function getWork(): SpecialPlace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORK);
    if (raw) {
      return JSON.parse(raw) as SpecialPlace;
    }
  } catch (error) {
    console.error("Error reading work location:", error);
  }
  return null;
}

function setWork(place: SpecialPlace): void {
  try {
    localStorage.setItem(STORAGE_KEY_WORK, JSON.stringify(place));
  } catch (error) {
    console.error("Error saving work location:", error);
  }
}

function removeWork(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_WORK);
  } catch (error) {
    console.error("Error removing work location:", error);
  }
}

export default {
  getHome,
  setHome,
  removeHome,
  getWork,
  setWork,
  removeWork,
};
