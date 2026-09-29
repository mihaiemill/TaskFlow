import { createContext, useContext, useEffect, useState } from "react";
import { redirectTo } from "../lib/navigation.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");
        if (urlToken) {
            localStorage.setItem("token", urlToken);
            return urlToken;
        }
        return localStorage.getItem("token");
    });

    const [avatar, setAvatar] = useState(null);

    useEffect(() => {
        if (!token) { setAvatar(null); return; }
        let cancelled = false;
        fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
            .then(async r => {
                if (r.ok) return r.json();
                // sesiune invalidă (cont dezactivat/șters) → afară din cont, cu alertă dacă e inactiv
                if (r.status === 401 && !cancelled) {
                    const body = await r.json().catch(() => ({}));
                    localStorage.removeItem("token");
                    redirectTo(body.code === "account_inactive" ? "/login?error=account_inactive" : "/login");
                }
                return Promise.reject();
            })
            .then(d => { if (!cancelled) setAvatar(d.avatar ?? null); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [token]);

    const login = (newToken) => {
        localStorage.setItem("token", newToken);
        setToken(newToken);
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ token, login, logout, isAuth: !!token, avatar, setAvatar }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);