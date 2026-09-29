import { createContext, useContext, useState } from "react";

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
    const [sidebarOpen, setSidebarOpenState] = useState(() => {
        // Pe mobile sidebar-ul pornește mereu închis
        if (window.innerWidth < 768) return false;
        const s = localStorage.getItem("sidebarOpen");
        return s !== null ? s === "true" : true;
    });

    const setSidebarOpen = (next) => {
        setSidebarOpenState(prev => {
            const value = typeof next === "function" ? next(prev) : next;
            localStorage.setItem("sidebarOpen", String(value));
            return value;
        });
    };

    return (
        <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebarState() {
    const ctx = useContext(SidebarContext);
    if (!ctx) throw new Error("useSidebarState must be used inside SidebarProvider");
    return ctx;
}
