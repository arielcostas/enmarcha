import { useState } from "react";

/**
 * A simple hook for managing favorite items in localStorage.
 * @param key LocalStorage key to use
 * @returns [favorites, toggleFavorite, isFavorite]
 */
export function useFavorites(key: string) {
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  });

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };

  const isFavorite = (id: string) => favorites.includes(id);

  return { favorites, toggleFavorite, isFavorite };
}
