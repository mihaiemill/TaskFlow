import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";

function getUserId(token) {
    if (!token) return "guest";
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.sub ?? "guest";
    } catch {
        return "guest";
    }
}

function load(userId) {
    try { return JSON.parse(localStorage.getItem(`favorites_v1_${userId}`)) ?? []; }
    catch { return []; }
}

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
    const auth = useAuth();
    const token = auth?.token ?? null;
    const userId = getUserId(token);

    const [favorites, setFavorites] = useState(() => load(userId));

    // Reincarca favoritele cand se schimba userul
    useEffect(() => {
        setFavorites(load(userId));
    }, [userId]);

    const isFavorite = useCallback(
        (type, id) => favorites.some(f => f.type === type && String(f.id) === String(id)),
        [favorites]
    );

    const toggleFavorite = useCallback((item) => {
        setFavorites(prev => {
            const exists = prev.some(f => f.type === item.type && String(f.id) === String(item.id));
            const next = exists
                ? prev.filter(f => !(f.type === item.type && String(f.id) === String(item.id)))
                : [...prev, item];
            localStorage.setItem(`favorites_v1_${userId}`, JSON.stringify(next));
            return next;
        });
    }, [userId]);

    const removeFavorite = useCallback((type, id) => {
        setFavorites(prev => {
            const next = prev.filter(f => !(f.type === type && String(f.id) === String(id)));
            localStorage.setItem(`favorites_v1_${userId}`, JSON.stringify(next));
            return next;
        });
    }, [userId]);

    // Actualizeaza campurile "cache-uite" ale unui favorit deja existent (ex. numele, dupa o redenumire),
    // fara sa il adauge daca nu e deja favorit. Nu scrie in localStorage daca nimic nu s-a schimbat.
    const updateFavorite = useCallback((type, id, patch) => {
        setFavorites(prev => {
            const idx = prev.findIndex(f => f.type === type && String(f.id) === String(id));
            if (idx === -1) return prev;

            const current = prev[idx];
            const changed = Object.keys(patch).some(k => current[k] !== patch[k]);
            if (!changed) return prev;

            const next = [...prev];
            next[idx] = { ...current, ...patch };
            localStorage.setItem(`favorites_v1_${userId}`, JSON.stringify(next));
            return next;
        });
    }, [userId]);

    return (
        <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, removeFavorite, updateFavorite }}>
            {children}
        </FavoritesContext.Provider>
    );
}

export function useFavorites() {
    const ctx = useContext(FavoritesContext);
    if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
    return ctx;
}