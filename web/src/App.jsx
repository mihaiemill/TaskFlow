import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import { SidebarProvider } from "./context/SidebarContext";
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

export default function App() {
    return (
        <AuthProvider>
            <FavoritesProvider>
                <SidebarProvider>
                    <BrowserRouter>
                        <Routes>
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
                        </Routes>
                    </BrowserRouter>
                </SidebarProvider>
            </FavoritesProvider>
        </AuthProvider>
    );
}