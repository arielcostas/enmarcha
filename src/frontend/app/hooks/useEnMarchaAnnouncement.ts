import { useEffect, useState } from "react";

export const useEnMarchaAnnouncement = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const lastShown = localStorage.getItem("enmarcha_announcement_last_shown");
    const today = new Date().toISOString().split("T")[0];

    if (lastShown !== today) {
      // Show after a short delay to not overwhelm the user immediately on load
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const closeAnnouncement = () => {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("enmarcha_announcement_last_shown", today);
    setIsOpen(false);
  };

  return {
    isOpen,
    closeAnnouncement,
  };
};
