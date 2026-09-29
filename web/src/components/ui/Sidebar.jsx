import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useFavorites } from "../../context/FavoritesContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSidebarState } from "../../context/SidebarContext.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import { ChangePasswordDialog } from "../ChangePasswordDialog.jsx";
import { UserAvatar } from "../UserAvatar.jsx";
import { AvatarDialog } from "../AvatarDialog.jsx";
import { apiFetch } from "../admin/shared.jsx";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./alert-dialog.jsx";

function getFullName(token) {
    try { return JSON.parse(atob(token.split(".")[1]))?.fullName ?? ""; }
    catch { return ""; }
}

function FolderIcon({ className = "", style }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
    );
}

function FavBadge({ dark }) {
    return (
        <span className={`absolute -top-1 -right-1 flex items-center justify-center w-3.5 h-3.5 rounded-full ${dark ? "bg-[#1e1c3a]" : "bg-white"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
        </span>
    );
}

function StarIcon({ filled, className = "" }) {
    return filled ? (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );
}

function GearIcon({ className = "" }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
    );
}

function DashboardIcon({ className = "" }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>
        </svg>
    );
}

function GroupsIcon({ className = "" }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
    );
}

function UsersIcon({ className = "" }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
    );
}

function ChangePasswordButton({ dark, onClick }) {
    return (
        <button
            onClick={onClick}
            title="Schimbă parola"
            className={`p-1.5 rounded-md transition-colors duration-150 cursor-pointer
                ${dark ? "text-[#9b98c8] hover:text-white hover:bg-[#524E91]/30"
                       : "text-gray-500 hover:text-[#524E91] hover:bg-[#524E91]/10"}`}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
        </button>
    );
}

function MyAvatarButton({ name, avatar, onClick }) {
    return (
        <button type="button" onClick={onClick} title="Schimbă avatarul"
            className="shrink-0 rounded-full cursor-pointer transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-[#524E91]">
            <UserAvatar avatar={avatar} name={name} className="size-7 text-base" title="Schimbă avatarul" />
        </button>
    );
}

const RAIL_PROJECT_LIMIT = 5;
const RAIL_MENU_WIDTH = 192; // w-48

export function Sidebar({ projects = [] }) {
    const [search, setSearch] = useState("");
    const [favOpen, setFavOpen] = useState(true);
    const [logoutOpen, setLogoutOpen] = useState(false);
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [avatarOpen, setAvatarOpen] = useState(false);
    const [railExpanded, setRailExpanded] = useState(false);
    const [collapsedFavProjects, setCollapsedFavProjects] = useState({});
    const [adminMenuOpen, setAdminMenuOpen] = useState(false);
    const [railMenuPos, setRailMenuPos] = useState({ top: 0, left: 0 });
    const railAdminBtnRef = useRef(null);
    const { sidebarOpen, setSidebarOpen } = useSidebarState();
    const { dark } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const { favorites, removeFavorite } = useFavorites();
    const { token, logout, avatar, setAvatar } = useAuth();

    async function saveMyAvatar(key) {
        const r = await apiFetch("/api/auth/avatar", token, { method: "PATCH", body: JSON.stringify({ avatar: key }) });
        if (!r.ok) { const e = await r.json().catch(() => ({})); return e.error ?? "Eroare la salvare."; }
        setAvatar(key);
        return null;
    }
    const fullName = getFullName(token ?? "");

    let isAdmin = false;
    try {
        if (token) {
            const decoded = jwtDecode(token);
            const userEmail = decoded?.email ?? decoded?.Email ?? "";
            isAdmin = userEmail === "admin@admin.com";
        }
    } catch {}

    const handleLogout = () => { logout(); navigate("/login"); };

    const activeProjectId = location.pathname.match(/\/projects\/(\d+)/)?.[1];
    const activeTaskId    = location.pathname.match(/\/tasks\/(\d+)/)?.[1];

    const toggle = () => { setAdminMenuOpen(false); setSidebarOpen(o => !o); };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    const favProjects = favorites.filter(f => f.type === "project");
    const favTasks    = favorites.filter(f => f.type === "task");
    const hasFavorites = favorites.length > 0;

    // Taskurile favorite al căror proiect e și el favorit se afișează imbricat sub proiect
    const favProjectIds = new Set(favProjects.map(p => String(p.id)));
    const nestedFavTasksByProject = favTasks.reduce((acc, t) => {
        const key = String(t.projectId);
        if (!favProjectIds.has(key)) return acc;
        (acc[key] ??= []).push(t);
        return acc;
    }, {});
    const standaloneFavTasks = favTasks.filter(t => !favProjectIds.has(String(t.projectId)));
    const isFavProjectExpanded = id => !collapsedFavProjects[String(id)];
    const toggleFavProjectExpanded = id =>
        setCollapsedFavProjects(prev => ({ ...prev, [String(id)]: !prev[String(id)] }));

    const sidebarBg = dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200";
    const activeBg  = dark ? "bg-[#524E91]/30 text-white" : "bg-[#524E91]/10 text-[#524E91]";
    const hoverCls  = dark ? "text-gray-400 hover:bg-[#524E91]/20 hover:text-white" : "text-gray-600 hover:bg-[#524E91]/8 hover:text-[#524E91]";
    const badgeCls  = dark ? "bg-[#524E91]/30 text-[#9b98c8]" : "bg-[#524E91]/10 text-[#524E91]";

    return (
        <>
            {/* Mobile overlay */}
            <div
                className={`fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity duration-300 ease-out
                    ${sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                onClick={toggle}
            />

            <aside className={`
                flex flex-col shrink-0 z-40 overflow-hidden
                fixed md:relative inset-y-0 left-0 h-screen
                transition-[width,translate] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                border-r ${sidebarBg}
                ${sidebarOpen
                    ? "w-64 translate-x-0"
                    : "w-64 -translate-x-full md:translate-x-0 md:w-16"}
            `} style={{ viewTransitionName: "sidebar" }}>

                <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap');`}</style>
                <div className={`relative w-64 h-14 shrink-0 border-b ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                    <Link
                        to="/projects"
                        inert={!sidebarOpen}
                        className={`absolute left-3 top-1/2 -translate-y-1/2 text-base select-none hover:opacity-75
                            transition-opacity ${sidebarOpen ? "opacity-100 duration-300 delay-100" : "opacity-0 duration-150"}
                            ${dark ? "text-white" : "text-gray-900"}`}
                        style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: "0.01em" }}
                    >
                        TaskFlow
                    </Link>
                    <button
                        onClick={toggle}
                        title={sidebarOpen ? "Închide sidebar" : "Deschide sidebar"}
                        className={`absolute left-4 top-3 flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer
                            transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                            ${sidebarOpen ? "translate-x-49" : "translate-x-0"}`}
                        style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                        </svg>
                    </button>
                </div>

                <div className="relative flex-1 min-h-0">

                {/* ── Bară minimală (doar desktop, sidebar închis) ── */}
                    <div
                        inert={sidebarOpen}
                        className={`hidden md:flex absolute inset-y-0 left-0 w-16 flex-col items-center overflow-hidden transition-opacity
                            ${sidebarOpen ? "opacity-0 duration-150" : "opacity-100 duration-300 delay-100"}`}>
                        <div className="flex-1 min-h-0 w-full overflow-y-auto flex flex-col items-center gap-1 py-3">
                            {hasFavorites && (
                                <>
                                    {favProjects.map(f => {
                                        const isActive = String(f.id) === String(activeProjectId);
                                        return (
                                            <Link
                                                key={`mfp-${f.id}`}
                                                to={`/projects/${f.id}`}
                                                title={f.name}
                                                className={`relative flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors duration-150 ${isActive ? activeBg : hoverCls}`}
                                            >
                                                <FolderIcon className="w-4.5 h-4.5" style={{ color: f.color || "#524E91" }} />
                                                <FavBadge dark={dark} />
                                            </Link>
                                        );
                                    })}

                                    {favTasks.map(f => {
                                        const isActive = String(f.id) === String(activeTaskId);
                                        return (
                                            <Link
                                                key={`mft-${f.id}`}
                                                to={`/tasks/${f.id}`}
                                                title={f.name}
                                                className={`relative flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors duration-150 ${isActive ? activeBg : hoverCls}`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5 text-[#5AC4C2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                                                </svg>
                                                <FavBadge dark={dark} />
                                            </Link>
                                        );
                                    })}

                                    <div className={`w-8 h-px my-1.5 shrink-0 ${dark ? "bg-[#3a3768]" : "bg-gray-200"}`} />
                                </>
                            )}

                            {(railExpanded ? projects : projects.slice(0, RAIL_PROJECT_LIMIT)).map(p => {
                                const isActive = String(p.id) === String(activeProjectId);
                                return (
                                    <Link
                                        key={p.id}
                                        to={`/projects/${p.id}`}
                                        title={p.name}
                                        className={`relative flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors duration-150 ${isActive ? activeBg : hoverCls}`}
                                    >
                                        <FolderIcon className="w-4.5 h-4.5" style={{ color: p.color || "#524E91" }} />
                                        {p.remainingTasks > 0 && (
                                            <span
                                                className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full text-[9px] leading-3.5 font-medium text-center"
                                                style={{ background: "#524E91", color: "white" }}
                                            >
                                                {p.remainingTasks}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}

                            {projects.length > RAIL_PROJECT_LIMIT && (
                                <button
                                    onClick={() => setRailExpanded(e => !e)}
                                    title={railExpanded ? "Restrânge lista" : `Vezi toate proiectele (${projects.length})`}
                                    className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors duration-150 cursor-pointer ${hoverCls}`}
                                >
                                    {railExpanded ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="18 15 12 9 6 15" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none" />
                                            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                                            <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none" />
                                        </svg>
                                    )}
                                </button>
                            )}
                        </div>

                        {fullName && (
                            <div className={`shrink-0 w-full flex flex-col items-center gap-1.5 py-3 border-t ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                                <MyAvatarButton name={fullName} avatar={avatar} onClick={() => setAvatarOpen(true)} />
                                {isAdmin && (
                                    <div className="relative">
                                        <button
                                            ref={railAdminBtnRef}
                                            onClick={() => {
                                                const rect = railAdminBtnRef.current?.getBoundingClientRect();
                                                if (rect) {
                                                    const idealLeft = rect.left + rect.width / 2 - RAIL_MENU_WIDTH / 2;
                                                    const left = Math.min(Math.max(idealLeft, 8), window.innerWidth - RAIL_MENU_WIDTH - 8);
                                                    setRailMenuPos({ top: rect.top, left });
                                                }
                                                setAdminMenuOpen(o => !o);
                                            }}
                                            title="Administrare"
                                            className={`p-1.5 rounded-md transition-colors duration-150 cursor-pointer
                                                ${adminMenuOpen
                                                    ? "text-white bg-[#524E91]/40"
                                                    : dark ? "text-[#9b98c8] hover:text-white hover:bg-[#524E91]/30"
                                                           : "text-gray-500 hover:text-[#524E91] hover:bg-[#524E91]/10"}`}>
                                            <GearIcon className="w-4 h-4" />
                                        </button>
                                        {adminMenuOpen && !sidebarOpen && createPortal(
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setAdminMenuOpen(false)} />
                                                <div
                                                    style={{ position: "fixed", top: railMenuPos.top - 8, left: railMenuPos.left, transform: "translateY(-100%)" }}
                                                    className={`z-50 w-48 rounded-xl border shadow-xl overflow-hidden
                                                        ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200"}`}>
                                                    <div className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-widest ${dark ? "text-[#6b68a0] bg-[#2d2b52]/50" : "text-gray-400 bg-gray-50"}`}>
                                                        Administrare
                                                    </div>
                                                    <Link to="/admin" onClick={() => setAdminMenuOpen(false)}
                                                        className={`flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors
                                                            ${location.pathname === "/admin"
                                                                ? dark ? "bg-[#524E91]/20 text-white" : "bg-[#524E91]/8 text-[#524E91]"
                                                                : dark ? "text-[#9b98c8] hover:bg-[#2d2b52]" : "text-gray-600 hover:bg-gray-50"}`}>
                                                        <DashboardIcon className="w-3.5 h-3.5 shrink-0" />
                                                        Dashboard
                                                    </Link>
                                                    <Link to="/admin/groups" onClick={() => setAdminMenuOpen(false)}
                                                        className={`flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors border-t
                                                            ${dark ? "border-[#3a3768]" : "border-gray-100"}
                                                            ${location.pathname === "/admin/groups"
                                                                ? dark ? "bg-[#524E91]/20 text-white" : "bg-[#524E91]/8 text-[#524E91]"
                                                                : dark ? "text-[#9b98c8] hover:bg-[#2d2b52]" : "text-gray-600 hover:bg-gray-50"}`}>
                                                        <GroupsIcon className="w-3.5 h-3.5 shrink-0" />
                                                        Grupuri și permisiuni
                                                    </Link>
                                                    <Link to="/admin/users" onClick={() => setAdminMenuOpen(false)}
                                                        className={`flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors border-t
                                                            ${dark ? "border-[#3a3768]" : "border-gray-100"}
                                                            ${location.pathname === "/admin/users"
                                                                ? dark ? "bg-[#524E91]/20 text-white" : "bg-[#524E91]/8 text-[#524E91]"
                                                                : dark ? "text-[#9b98c8] hover:bg-[#2d2b52]" : "text-gray-600 hover:bg-gray-50"}`}>
                                                        <UsersIcon className="w-3.5 h-3.5 shrink-0" />
                                                        Utilizatori
                                                    </Link>
                                                </div>
                                            </>,
                                            document.body
                                        )}
                                    </div>
                                )}
                                <ChangePasswordButton dark={dark} onClick={() => setPasswordOpen(true)} />
                                <ThemeToggle />
                                <button
                                    onClick={() => setLogoutOpen(true)}
                                    title="Deconectare"
                                    className={`p-1.5 rounded-md transition-colors duration-150 cursor-pointer
                                        ${dark ? "text-[#9b98c8] hover:text-white hover:bg-[#524E91]/30"
                                               : "text-gray-500 hover:text-[#524E91] hover:bg-[#524E91]/10"}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>

                <div
                    inert={!sidebarOpen}
                    className={`absolute inset-y-0 left-0 w-64 flex flex-col overflow-hidden transition-opacity
                        ${sidebarOpen ? "opacity-100 duration-300 delay-100" : "opacity-0 duration-150"}`}>

                    {/* ── Favorite ── */}
                    <div className={`px-3 pt-3 border-b ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                        <button
                            onClick={() => setFavOpen(o => !o)}
                            className={`flex items-center gap-1.5 w-full text-xs font-semibold uppercase tracking-widest px-1 pb-2 transition-colors
                                ${dark ? "text-[#9b98c8] hover:text-white" : "text-gray-400 hover:text-[#524E91]"}`}
                        >
                            <StarIcon filled className="w-3 h-3 text-amber-400" />
                            <span className="flex-1 text-left">Favorite</span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`w-3 h-3 transition-transform duration-200 ${favOpen ? "rotate-90" : ""}`}
                                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            >
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>

                        {favOpen && (
                            <div className="pb-2">
                                {!hasFavorites && (
                                    <p className={`text-xs px-2 py-1 ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>
                                        Niciun favorit adăugat.
                                    </p>
                                )}

                                {favProjects.map(f => {
                                    const isActive = String(f.id) === String(activeProjectId);
                                    const children = nestedFavTasksByProject[String(f.id)] || [];
                                    const hasChildren = children.length > 0;
                                    const expanded = hasChildren && isFavProjectExpanded(f.id);
                                    return (
                                        <div key={`fp-${f.id}`} className="mb-0.5">
                                            <div className="group flex items-center gap-0.5">
                                                {hasChildren ? (
                                                    <button
                                                        onClick={() => toggleFavProjectExpanded(f.id)}
                                                        title={expanded ? "Restrânge task-urile" : `Arată ${children.length} task${children.length > 1 ? "uri" : ""} favorit${children.length > 1 ? "e" : ""}`}
                                                        className={`shrink-0 flex items-center justify-center w-4 h-4 rounded transition-colors duration-150 cursor-pointer
                                                            ${dark ? "text-[#6b68a0] hover:text-white" : "text-gray-400 hover:text-gray-600"}`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                                                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="9 18 15 12 9 6" />
                                                        </svg>
                                                    </button>
                                                ) : (
                                                    <span className="w-4 h-4 shrink-0" />
                                                )}
                                                <Link to={`/projects/${f.id}`} className="flex-1 min-w-0 block" onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}>
                                                    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors duration-150 ${isActive ? activeBg : hoverCls}`}>
                                                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: f.color || "#524E91" }} />
                                                        <span className={`text-xs truncate flex-1 ${isActive ? "font-medium" : ""}`}>{f.name}</span>
                                                        {hasChildren && (
                                                            <span className={`text-[10px] leading-none font-medium shrink-0 px-1.5 py-0.5 rounded-full ${dark ? "bg-[#3a3768] text-[#9b98c8]" : "bg-gray-100 text-gray-500"}`}>
                                                                {children.length}
                                                            </span>
                                                        )}
                                                        <span className={`text-xs shrink-0 font-medium ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>P</span>
                                                    </div>
                                                </Link>
                                                <button
                                                    onClick={() => removeFavorite("project", f.id)}
                                                    title="Elimină din favorite"
                                                    className={`shrink-0 p-1 rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity
                                                        ${dark ? "text-[#6b68a0] hover:text-amber-400" : "text-gray-400 hover:text-amber-500"}`}
                                                >
                                                    <StarIcon filled className="w-3 h-3 text-amber-400" />
                                                </button>
                                            </div>

                                            {expanded && (
                                                <div className={`ml-1.75 pl-2.5 mt-0.5 flex flex-col gap-0.5 border-l ${dark ? "border-[#3a3768]" : "border-gray-200"}`}>
                                                    {children.map(t => {
                                                        const isTaskActive = String(t.id) === String(activeTaskId);
                                                        return (
                                                            <div key={`ft-${t.id}`} className="group flex items-center gap-0.5">
                                                                <Link to={`/tasks/${t.id}`} className="flex-1 min-w-0 block" onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}>
                                                                    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors duration-150 ${isTaskActive ? activeBg : hoverCls}`}>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0 text-[#5AC4C2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                                                                        </svg>
                                                                        <span className={`text-xs truncate flex-1 ${isTaskActive ? "font-medium" : ""}`}>{t.name}</span>
                                                                    </div>
                                                                </Link>
                                                                <button
                                                                    onClick={() => removeFavorite("task", t.id)}
                                                                    title="Elimină din favorite"
                                                                    className={`shrink-0 p-1 rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity
                                                                        ${dark ? "text-[#6b68a0] hover:text-amber-400" : "text-gray-400 hover:text-amber-500"}`}
                                                                >
                                                                    <StarIcon filled className="w-3 h-3 text-amber-400" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {standaloneFavTasks.map(f => {
                                    const isActive = String(f.id) === String(activeTaskId);
                                    return (
                                        <div key={`ft-${f.id}`} className="group flex items-center gap-0.5 mb-0.5">
                                            <Link to={`/tasks/${f.id}`} className="flex-1 min-w-0 block" onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}>
                                                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors duration-150 ${isActive ? activeBg : hoverCls}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0 text-[#5AC4C2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                                                    </svg>
                                                    <span className={`text-xs truncate flex-1 ${isActive ? "font-medium" : ""}`}>{f.name}</span>
                                                    <span className={`text-xs shrink-0 truncate max-w-16 ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>{f.projectName}</span>
                                                </div>
                                            </Link>
                                            <button
                                                onClick={() => removeFavorite("task", f.id)}
                                                title="Elimină din favorite"
                                                className={`shrink-0 p-1 rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity
                                                    ${dark ? "text-[#6b68a0] hover:text-amber-400" : "text-gray-400 hover:text-amber-500"}`}
                                            >
                                                <StarIcon filled className="w-3 h-3 text-amber-400" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Proiectele mele + Căutare ── */}
                    <div className={`px-3 pt-3 pb-2 border-b ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                        <Link
                            to="/projects"
                            onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}
                            className={`block text-xs font-semibold uppercase tracking-widest px-1 pb-2 transition-colors duration-150
                                ${dark ? "text-[#6b68a0] hover:text-white" : "text-gray-400 hover:text-[#524E91]"}`}
                        >
                            Proiectele mele
                        </Link>

                        <div className={`flex items-center gap-2 px-3 h-9 rounded-lg border transition-colors
                            ${dark ? "bg-[#2d2b52] border-[#3a3768] focus-within:border-[#524E91]"
                                   : "bg-gray-50 border-gray-200 focus-within:border-[#524E91]"}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 shrink-0 ${dark ? "text-[#6b68a0]" : "text-gray-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Caută proiecte..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className={`flex-1 bg-transparent text-xs outline-none ${dark ? "text-white placeholder:text-[#6b68a0]" : "text-gray-900 placeholder:text-gray-400"}`}
                            />
                            {search && (
                                <button onClick={() => setSearch("")} className={`shrink-0 ${dark ? "text-[#6b68a0] hover:text-gray-300" : "text-gray-300 hover:text-gray-500"}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Lista proiecte ── */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 pb-0">
                        {filteredProjects.length === 0 && (
                            <p className={`text-xs px-2 py-1 ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>
                                {search ? "Niciun proiect găsit." : "Niciun proiect încă."}
                            </p>
                        )}

                        {filteredProjects.map(p => {
                            const isActive = String(p.id) === String(activeProjectId);
                            return (
                                <Link key={p.id} to={`/projects/${p.id}`} className="block" onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}>
                                    <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 transition-colors duration-150 cursor-pointer ${isActive ? activeBg : hoverCls}`}>
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || "#524E91" }} />
                                        <span className={`text-sm truncate flex-1 ${isActive ? "font-medium" : "font-normal"}`}>{p.name}</span>
                                        {p.remainingTasks > 0 && (
                                            <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full shrink-0 ${badgeCls}`}>
                                                {p.remainingTasks}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* ── Administrare — dropup cu Dashboard / Grupuri și permisiuni ── */}
                    {isAdmin && (
                        <div className={`shrink-0 px-3 pt-2 pb-1 border-t relative ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                            <button
                                onClick={() => setAdminMenuOpen(o => !o)}
                                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer
                                    ${adminMenuOpen ? activeBg : hoverCls}`}>
                                <GearIcon className="w-4 h-4 shrink-0" />
                                <span className="flex-1 text-left">Administrare</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 shrink-0 transition-transform duration-200 ${adminMenuOpen ? "" : "rotate-180"}`}
                                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="18 15 12 9 6 15" />
                                </svg>
                            </button>

                            {adminMenuOpen && sidebarOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setAdminMenuOpen(false)} />
                                    <div className={`absolute left-3 right-3 bottom-full mb-1 z-50 rounded-xl border shadow-xl overflow-hidden
                                        ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200"}`}>
                                        <Link to="/admin" onClick={() => { setAdminMenuOpen(false); window.innerWidth < 768 && setSidebarOpen(false); }}
                                            className={`flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium transition-colors
                                                ${location.pathname === "/admin"
                                                    ? dark ? "bg-[#524E91]/20 text-white" : "bg-[#524E91]/8 text-[#524E91]"
                                                    : dark ? "text-[#9b98c8] hover:bg-[#2d2b52]" : "text-gray-600 hover:bg-gray-50"}`}>
                                            <DashboardIcon className="w-3.5 h-3.5 shrink-0" />
                                            Dashboard
                                        </Link>
                                        <Link to="/admin/groups" onClick={() => { setAdminMenuOpen(false); window.innerWidth < 768 && setSidebarOpen(false); }}
                                            className={`flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium transition-colors border-t
                                                ${dark ? "border-[#3a3768]" : "border-gray-100"}
                                                ${location.pathname === "/admin/groups"
                                                    ? dark ? "bg-[#524E91]/20 text-white" : "bg-[#524E91]/8 text-[#524E91]"
                                                    : dark ? "text-[#9b98c8] hover:bg-[#2d2b52]" : "text-gray-600 hover:bg-gray-50"}`}>
                                            <GroupsIcon className="w-3.5 h-3.5 shrink-0" />
                                            Grupuri și permisiuni
                                        </Link>
                                        <Link to="/admin/users" onClick={() => { setAdminMenuOpen(false); window.innerWidth < 768 && setSidebarOpen(false); }}
                                            className={`flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium transition-colors border-t
                                                ${dark ? "border-[#3a3768]" : "border-gray-100"}
                                                ${location.pathname === "/admin/users"
                                                    ? dark ? "bg-[#524E91]/20 text-white" : "bg-[#524E91]/8 text-[#524E91]"
                                                    : dark ? "text-[#9b98c8] hover:bg-[#2d2b52]" : "text-gray-600 hover:bg-gray-50"}`}>
                                            <UsersIcon className="w-3.5 h-3.5 shrink-0" />
                                            Utilizatori
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Footer user + butoane ── */}
                    {fullName && (
                        <div className={`shrink-0 px-3 py-3 border-t ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                            <div className="flex items-center gap-2">
                                <MyAvatarButton name={fullName} avatar={avatar} onClick={() => setAvatarOpen(true)} />
                                <div className="min-w-0 flex-1">
                                    <p className={`text-xs ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>Bun venit,</p>
                                    <p className={`text-xs font-medium truncate ${dark ? "text-white" : "text-gray-800"}`}>{fullName}</p>
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <ChangePasswordButton dark={dark} onClick={() => setPasswordOpen(true)} />
                                    <ThemeToggle />
                                    <button
                                        onClick={() => setLogoutOpen(true)}
                                        title="Deconectare"
                                        className={`p-1.5 rounded-md transition-colors duration-150 cursor-pointer
                                            ${dark ? "text-[#9b98c8] hover:text-white hover:bg-[#524E91]/30"
                                                   : "text-gray-500 hover:text-[#524E91] hover:bg-[#524E91]/10"}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                </div>
            </aside>

            <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />

            <AvatarDialog open={avatarOpen} onOpenChange={setAvatarOpen} name={fullName} currentAvatar={avatar}
                description="Alege unul din avatarele standard sau păstrează inițiala numelui." onSave={saveMyAvatar} />

            <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Te deconectezi?</AlertDialogTitle>
                        <AlertDialogDescription>Vei fi redirecționat către pagina de autentificare.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Anulează</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLogout} style={{ background: "#524E91" }} className="hover:opacity-90 text-white">
                            Deconectează-te
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
