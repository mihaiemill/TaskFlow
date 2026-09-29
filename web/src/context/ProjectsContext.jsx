import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosInstance.js";
import { useAuth } from "./AuthContext.jsx";

const ProjectsContext = createContext(null);

export function ProjectsProvider({ children }) {
    const { token } = useAuth();
    const [projects, setProjects] = useState([]);
    const inFlight = useRef(null);

    useEffect(() => {
        setProjects([]);
        inFlight.current = null;
    }, [token]);

    const refreshProjects = useCallback(() => {
        if (!token) return Promise.resolve();
        if (inFlight.current) return inFlight.current;
        inFlight.current = api.get("/projects")
            .then(r => setProjects(r.data))
            .catch(() => {})
            .finally(() => { inFlight.current = null; });
        return inFlight.current;
    }, [token]);

    const value = useMemo(() => ({ projects, setProjects, refreshProjects }), [projects, refreshProjects]);

    return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
    const ctx = useContext(ProjectsContext);
    if (!ctx) throw new Error("useProjects must be used inside ProjectsProvider");
    return ctx;
}
