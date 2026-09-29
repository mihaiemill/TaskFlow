import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import { SidebarProvider } from "./context/SidebarContext";
import { ProjectsProvider } from "./context/ProjectsContext";
import PrivateRoute from "./components/PrivateRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import GoogleCallbackPage from "./pages/GoogleCallbackPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminGroupsPage from "./pages/AdminGroupsPage";
import AdminUsersPage from "./pages/AdminUsersPage";

function AnimatedRoutes({ children }) {
    const location = useLocation();
    const [displayLocation, setDisplayLocation] = useState(location);

    useEffect(() => {
        if (location.key === displayLocation.key) return;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // doar query-ul s-a schimbat (ex. ?tab= în dashboard) → aceeași pagină, fără tranziție
        const samePage = location.pathname === displayLocation.pathname;
        if (!document.startViewTransition || reduceMotion || samePage) {
            setDisplayLocation(location);
            return;
        }
        document.startViewTransition(() => flushSync(() => setDisplayLocation(location)));
    }, [location, displayLocation.key]);

    return <Routes location={displayLocation}>{children}</Routes>;
}

export default function App() {
    return (
        <AuthProvider>
            <FavoritesProvider>
                <ProjectsProvider>
                <SidebarProvider>
                    <BrowserRouter>
                        <AnimatedRoutes>
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                            <Route path="/auth/google" element={<GoogleCallbackPage />} />
                            <Route path="/projects" element={
                                <PrivateRoute><ProjectsPage /></PrivateRoute>
                            } />
                            <Route path="/projects/:id" element={
                                <PrivateRoute><ProjectDetailPage /></PrivateRoute>
                            } />
                            <Route path="/tasks/:id" element={
                                <PrivateRoute><TaskDetailPage /></PrivateRoute>
                            } />
                            <Route path="/admin" element={
                                <PrivateRoute><AdminDashboardPage /></PrivateRoute>
                            } />
                            <Route path="/admin/groups" element={
                                <PrivateRoute><AdminGroupsPage /></PrivateRoute>
                            } />
                            <Route path="/admin/users" element={
                                <PrivateRoute><AdminUsersPage /></PrivateRoute>
                            } />
                            <Route path="*" element={<Navigate to="/projects" />} />
                        </AnimatedRoutes>
                    </BrowserRouter>
                </SidebarProvider>
                </ProjectsProvider>
            </FavoritesProvider>
        </AuthProvider>
    );
}