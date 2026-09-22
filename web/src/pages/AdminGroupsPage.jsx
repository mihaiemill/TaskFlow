import { useState, useEffect, useMemo } from "react";
import { Topbar } from "../components/ui/Topbar.jsx";
import { Sidebar } from "../components/ui/Sidebar.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
    SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { apiFetch, SearchInput, PermSelector, PERM_OPTIONS } from "../components/admin/shared.jsx";

// ── main ──────────────────────────────────────────────────────────────────────

export default function AdminGroupsPage() {
    const { dark } = useTheme();
    const { token } = useAuth();

    const [projects,       setProjects]       = useState([]);
    const [groups,         setGroups]         = useState([]);
    const [groupsLoading,  setGroupsLoading]  = useState(true);
    const [allUsers,       setAllUsers]       = useState([]);
    const [assignments,    setAssignments]    = useState([]);
    const [tableSearch,    setTableSearch]    = useState("");
    const [groupSearch,    setGroupSearch]    = useState("");
    const [groupPage,      setGroupPage]      = useState(0);

    // ── sheet: creare grup ────────────────────────────────────────────────────
    const [sheetOpen,      setSheetOpen]      = useState(false);
    const [groupName,      setGroupName]      = useState("");
    const [selectedUIDs,   setSelectedUIDs]   = useState(new Set());
    const [userSearch,     setUserSearch]     = useState("");
    const [creating,       setCreating]       = useState(false);
    const [createError,    setCreateError]    = useState("");
    const [duplicateGroup, setDuplicateGroup] = useState(null);
    const [deleteTarget,   setDeleteTarget]   = useState(null);

    useEffect(() => {
        if (!token) return;
        fetch("/api/admin/users", { headers: { Authorization:`Bearer ${token}` } })
            .then(r => r.ok ? r.json() : Promise.reject()).then(setAllUsers).catch(console.error);
        fetch("/api/admin/groups", { headers: { Authorization:`Bearer ${token}` } })
            .then(r => r.ok ? r.json() : Promise.reject()).then(setGroups).catch(console.error)
            .finally(() => setGroupsLoading(false));
        fetch("/api/admin/assignments", { headers: { Authorization:`Bearer ${token}` } })
            .then(r => r.ok ? r.json() : Promise.reject()).then(setAssignments).catch(console.error);
        // proiectele utilizatorului curent pentru sidebar
        fetch("/api/projects", { headers: { Authorization:`Bearer ${token}` } })
            .then(r => r.ok ? r.json() : Promise.reject()).then(setProjects).catch(console.error);
    }, [token]);

    function resetGroupForm() {
        setGroupName(""); setSelectedUIDs(new Set()); setUserSearch(""); setCreateError("");
    }

    function toggleUser(uid) {
        setSelectedUIDs(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });
    }

    async function handleCreateGroup() {
        if (!groupName.trim()) { setCreateError("Introdu un nume pentru grup."); return; }
        if (selectedUIDs.size === 0) { setCreateError("Selecteaza cel putin un utilizator."); return; }
        const existing = groups.find(g => g.name.trim().toLowerCase() === groupName.trim().toLowerCase());
        if (existing) { setDuplicateGroup(existing); return; }
        setCreating(true); setCreateError("");
        try {
            const r = await apiFetch("/api/admin/groups", token, {
                method: "POST",
                body: JSON.stringify({ name: groupName.trim(), userIds: [...selectedUIDs] }),
            });
            if (!r.ok) { const e = await r.json(); setCreateError(e.error ?? "Eroare la creare."); return; }
            const newGroup = await r.json();
            setGroups(prev => [...prev, newGroup]);
            resetGroupForm();
            setSheetOpen(false);
        } catch { setCreateError("Eroare de retea."); }
        finally { setCreating(false); }
    }

    async function handleAddToExistingGroup() {
        if (!duplicateGroup) return;
        const existingIds = duplicateGroup.users?.map(u => u.id) ?? [];
        const mergedIds   = [...new Set([...existingIds, ...selectedUIDs])];
        setCreating(true);
        try {
            const r = await apiFetch(`/api/admin/groups/${duplicateGroup.id}`, token, {
                method: "PUT",
                body: JSON.stringify({ name: duplicateGroup.name, userIds: mergedIds }),
            });
            if (!r.ok) { const e = await r.json(); setCreateError(e.error ?? "Eroare la actualizare."); return; }
            const updated = await r.json();
            setGroups(prev => prev.map(g => g.id === duplicateGroup.id ? updated : g));
            resetGroupForm();
            setSheetOpen(false);
        } catch { setCreateError("Eroare de retea."); }
        finally { setCreating(false); setDuplicateGroup(null); }
    }

    async function setGroupPermLevel(groupId, level) {
        const prev = groups.find(g => g.id === groupId)?.permissionLevel ?? 1;
        setGroups(gs => gs.map(g => g.id !== groupId ? g : { ...g, permissionLevel: level }));
        try {
            await apiFetch(`/api/admin/groups/${groupId}/permissions`, token, {
                method: "PUT",
                body: JSON.stringify({ permissionLevel: level }),
            });
        } catch {
            setGroups(gs => gs.map(g => g.id !== groupId ? g : { ...g, permissionLevel: prev }));
        }
    }

    async function handleDeleteGroup() {
        if (!deleteTarget) return;
        const groupId = deleteTarget.id;
        setDeleteTarget(null);
        await deleteGroup(groupId);
    }

    async function deleteGroup(groupId) {
        setGroups(prev => prev.filter(g => g.id !== groupId));
        await apiFetch(`/api/admin/groups/${groupId}`, token, { method: "DELETE" })
            .catch(() => fetch("/api/admin/groups", { headers:{Authorization:`Bearer ${token}`} })
                .then(r=>r.json()).then(setGroups).catch(console.error));
    }

    async function removeUserFromGroup(group, userId) {
        const newUserIds = group.users.filter(u => u.id !== userId).map(u => u.id);
        // optimistic update
        setGroups(prev => prev.map(g => g.id !== group.id ? g : { ...g, users: g.users.filter(u => u.id !== userId) }));
        try {
            const r = await apiFetch(`/api/admin/groups/${group.id}`, token, {
                method: "PUT",
                body: JSON.stringify({ name: group.name, userIds: newUserIds }),
            });
            if (r.ok) {
                const updated = await r.json();
                setGroups(prev => prev.map(g => g.id === group.id ? updated : g));
            } else {
                setGroups(prev => prev.map(g => g.id !== group.id ? g : group)); // revert
            }
        } catch {
            setGroups(prev => prev.map(g => g.id !== group.id ? g : group)); // revert
        }
    }

    const cardBg = dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200";
    const th     = dark ? "text-[#9b98c8]" : "text-gray-500";
    const td     = dark ? "text-white border-[#3a3768]" : "text-gray-800 border-gray-100";
    const stripe = dark ? "hover:bg-[#524E91]/10" : "hover:bg-[#524E91]/5";

    const filteredUsers = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        return q ? allUsers.filter(u => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : allUsers;
    }, [allUsers, userSearch]);

    // ── mini dashboard: grup(uri) + permisiune + proiecte accesibile, per utilizator ──
    const userGroupsMap = useMemo(() => {
        const map = new Map(); // userId -> [group, ...]
        groups.forEach(g => g.users?.forEach(u => {
            if (!map.has(u.id)) map.set(u.id, []);
            map.get(u.id).push(g);
        }));
        return map;
    }, [groups]);

    const userProjectsMap = useMemo(() => {
        const map = new Map(); // userId -> Map(projectId -> {id,name,color})
        const addProject = (userId, a) => {
            if (!map.has(userId)) map.set(userId, new Map());
            map.get(userId).set(a.projectId, { id: a.projectId, name: a.projectName, color: a.projectColor });
        };
        assignments.forEach(a => {
            if (a.type === "user" && a.userId) {
                addProject(a.userId, a);
            } else if (a.type === "group" && a.groupId) {
                const group = groups.find(g => g.id === a.groupId);
                group?.users?.forEach(u => addProject(u.id, a));
            }
        });
        return map;
    }, [assignments, groups]);

    const usersInGroupsCount = userGroupsMap.size;
    const usersWithoutGroup  = Math.max(allUsers.length - usersInGroupsCount, 0);
    const projectsWithAccess = new Set(assignments.map(a => a.projectId)).size;

    // ── grila de grupuri: cautare + paginare cu sageti (doar cand sunt multe grupuri) ──
    const GROUPS_PAGE_SIZE = 3;
    const filteredGroups = useMemo(() => {
        const q = groupSearch.trim().toLowerCase();
        return q ? groups.filter(g => g.name.toLowerCase().includes(q)) : groups;
    }, [groups, groupSearch]);
    const groupPageCount = Math.max(1, Math.ceil(filteredGroups.length / GROUPS_PAGE_SIZE));
    const clampedGroupPage = Math.min(groupPage, groupPageCount - 1);
    const pagedGroups = filteredGroups.slice(clampedGroupPage * GROUPS_PAGE_SIZE, (clampedGroupPage + 1) * GROUPS_PAGE_SIZE);
    const showGroupControls = groups.length > GROUPS_PAGE_SIZE;

    function handleGroupSearchChange(v) {
        setGroupSearch(v);
        setGroupPage(0);
    }

    const filteredTableUsers = useMemo(() => {
        const q = tableSearch.trim().toLowerCase();
        if (!q) return allUsers;
        return allUsers.filter(u =>
            u.fullName.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (userGroupsMap.get(u.id) ?? []).some(g => g.name.toLowerCase().includes(q))
        );
    }, [allUsers, tableSearch, userGroupsMap]);

    return (
        <>
        <div className={`flex h-screen overflow-hidden ${dark ? "bg-[#16152e]" : "bg-gray-50"}`}>
            <Sidebar projects={projects} />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Topbar breadcrumbs={[{ label:"Grupuri și permisiuni" }]} />

                <main className={`flex-1 overflow-y-auto p-6 sm:p-8 ${dark ? "text-white" : "text-gray-900"}`}>
                    <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap');`}</style>

                    <div className="max-w-6xl mx-auto">

                        {/* header */}
                        <div className="mb-7 flex items-center gap-3">
                            <div className="w-1 h-9 rounded-full shrink-0" style={{background:"linear-gradient(180deg,#524E91,#5AC4C2)"}}/>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2.5">
                                    <h1 className={`text-2xl font-bold leading-tight ${dark?"text-white":"text-gray-900"}`} style={{fontFamily:"'Space Grotesk',sans-serif"}}>
                                        Grupuri și permisiuni
                                    </h1>
                                    {!groupsLoading && groups.length > 0 && (
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dark ? "bg-[#2d2b52] text-[#9b98c8]" : "bg-gray-100 text-gray-500"}`}>
                                            {groups.length}
                                        </span>
                                    )}
                                </div>
                                <p className={`text-xs mt-1 ${dark?"text-[#6b68a0]":"text-gray-400"}`}>Organizează utilizatorii în grupuri și controlează nivelul de acces</p>
                            </div>
                            <button onClick={() => setSheetOpen(true)}
                                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 cursor-pointer"
                                style={{background:"linear-gradient(135deg,#524E91,#5AC4C2)"}}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                Grup nou
                            </button>
                        </div>

                        {/* ── Mini dashboard: statistici acces ── */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {[
                                { label: "Grupuri", value: groups.length, icon: (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                ) },
                                { label: "Utilizatori", value: allUsers.length, icon: (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                ) },
                                { label: "Fără grup", value: usersWithoutGroup, icon: (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h1"/><line x1="17" y1="14" x2="22" y2="19"/><line x1="22" y1="14" x2="17" y2="19"/></svg>
                                ) },
                                { label: "Proiecte cu acces", value: projectsWithAccess, icon: (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                                ) },
                            ].map(({ label, value, icon }) => (
                                <div key={label} className={`flex items-center gap-3.5 rounded-2xl border p-4 ${cardBg}`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${dark ? "bg-[#2d2b52] text-[#9b98c8]" : "bg-[#524E91]/10 text-[#524E91]"}`}>
                                        {icon}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-[10px] uppercase tracking-widest font-semibold ${dark?"text-[#6b68a0]":"text-gray-400"}`}>{label}</p>
                                        <p className={`text-xl font-bold leading-tight ${dark?"text-white":"text-gray-900"}`} style={{fontFamily:"'Space Grotesk',sans-serif"}}>
                                            {groupsLoading ? <span className={`inline-block w-6 h-5 rounded animate-pulse ${dark?"bg-[#3a3768]":"bg-gray-200"}`}/> : value}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Grid grupuri ── */}
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                            <h2 className={`text-xs font-semibold uppercase tracking-widest shrink-0 ${dark?"text-[#6b68a0]":"text-gray-400"}`}>Grupuri</h2>
                            {showGroupControls && (
                                <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto flex-wrap">
                                    <div className="w-full sm:w-52">
                                        <SearchInput value={groupSearch} onChange={handleGroupSearchChange} placeholder="Cauta dupa nume..." dark={dark}/>
                                    </div>
                                    <div className={`flex items-center rounded-lg border overflow-hidden shrink-0 ${dark ? "border-[#3a3768]" : "border-gray-200"}`}>
                                        <button onClick={() => setGroupPage(p => Math.max(0, p - 1))} disabled={clampedGroupPage === 0}
                                            title="Grupul anterior"
                                            className={`flex items-center justify-center w-8 h-9 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer
                                                ${dark ? "text-[#9b98c8] hover:bg-[#2d2b52] disabled:hover:bg-transparent" : "text-gray-500 hover:bg-gray-50 disabled:hover:bg-transparent"}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="15 18 9 12 15 6" />
                                            </svg>
                                        </button>
                                        <span className={`px-2 text-[11px] font-medium tabular-nums border-x ${dark ? "border-[#3a3768] text-[#9b98c8]" : "border-gray-200 text-gray-500"}`}>
                                            {clampedGroupPage + 1}/{groupPageCount}
                                        </span>
                                        <button onClick={() => setGroupPage(p => Math.min(groupPageCount - 1, p + 1))} disabled={clampedGroupPage >= groupPageCount - 1}
                                            title="Grupul urmator"
                                            className={`flex items-center justify-center w-8 h-9 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer
                                                ${dark ? "text-[#9b98c8] hover:bg-[#2d2b52] disabled:hover:bg-transparent" : "text-gray-500 hover:bg-gray-50 disabled:hover:bg-transparent"}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        {groupsLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-6 h-6 rounded-full border-2 border-[#524E91] border-t-transparent animate-spin"/>
                            </div>
                        ) : groups.length === 0 ? (
                            <div className={`rounded-2xl border p-14 flex flex-col items-center justify-center text-center gap-3 ${cardBg}`}>
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${dark ? "bg-[#2d2b52]" : "bg-[#524E91]/10"}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" style={{ color: "#524E91" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                    </svg>
                                </div>
                                <p className={`text-sm ${dark?"text-[#9b98c8]":"text-gray-500"}`}>Niciun grup creat încă.</p>
                                <button onClick={() => setSheetOpen(true)}
                                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 cursor-pointer"
                                    style={{background:"linear-gradient(135deg,#524E91,#5AC4C2)"}}>
                                    Creează primul grup
                                </button>
                            </div>
                        ) : filteredGroups.length === 0 ? (
                            <div className={`rounded-2xl border p-10 flex flex-col items-center justify-center text-center gap-1 ${cardBg}`}>
                                <p className={`text-sm ${dark?"text-[#9b98c8]":"text-gray-500"}`}>Niciun grup găsit pentru „{groupSearch}".</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {pagedGroups.map(g => (
                                    <div key={g.id} className={`rounded-2xl border overflow-hidden flex flex-col transition-shadow duration-200 hover:shadow-md ${cardBg}`}>
                                        <div className={`px-4 py-3.5 border-b flex items-center gap-2.5 ${dark?"border-[#3a3768]":"border-gray-100"}`}>
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dark ? "bg-[#2d2b52]" : "bg-[#524E91]/10"}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" style={{ color: "#524E91" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                                </svg>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm font-semibold truncate ${dark?"text-white":"text-gray-800"}`}>{g.name}</p>
                                                <p className={`text-[11px] ${dark?"text-[#6b68a0]":"text-gray-400"}`}>{g.users?.length ?? 0} utilizator{(g.users?.length ?? 0)!==1?"i":""}</p>
                                            </div>
                                            <button onClick={()=>setDeleteTarget(g)}
                                                className={`p-1.5 rounded-md transition-colors shrink-0 cursor-pointer ${dark?"text-[#6b68a0] hover:text-rose-400 hover:bg-rose-400/10":"text-gray-300 hover:text-rose-500 hover:bg-rose-50"}`}
                                                title="Sterge grupul">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                                </svg>
                                            </button>
                                        </div>

                                        <div className={`px-4 py-2.5 flex items-center justify-between gap-2 border-b ${dark?"border-[#3a3768]":"border-gray-100"}`}>
                                            <span className={`text-[10px] uppercase tracking-widest font-semibold ${dark?"text-[#6b68a0]":"text-gray-400"}`}>Permisiune</span>
                                            <PermSelector level={g.permissionLevel} onChange={lvl => setGroupPermLevel(g.id, lvl)} dark={dark}/>
                                        </div>

                                        <div className="px-4 py-3.5 flex-1">
                                            {g.users?.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {g.users.map(u => (
                                                        <div key={u.id}
                                                            className={`flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs border
                                                                ${dark ? "bg-[#2d2b52] border-[#3a3768] text-[#9b98c8]" : "bg-gray-100 border-gray-200 text-gray-600"}`}>
                                                            <span className="truncate max-w-32">{u.fullName}</span>
                                                            <button
                                                                onClick={() => removeUserFromGroup(g, u.id)}
                                                                title={`Scoate pe ${u.fullName} din grup`}
                                                                className={`shrink-0 flex items-center justify-center w-4 h-4 rounded-full transition-colors
                                                                    ${dark ? "hover:bg-rose-400/20 hover:text-rose-400" : "hover:bg-rose-100 hover:text-rose-500"}`}>
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className={`text-xs italic ${dark?"text-[#6b68a0]":"text-gray-400"}`}>Niciun utilizator în grup.</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Utilizatori si acces ── */}
                        <div className="flex items-center gap-2 mt-8 mb-3">
                            <h2 className={`text-xs font-semibold uppercase tracking-widest ${dark?"text-[#6b68a0]":"text-gray-400"}`}>Utilizatori și acces</h2>
                        </div>
                        <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
                            <div className="px-5 pt-4 pb-1">
                                <SearchInput value={tableSearch} onChange={setTableSearch} placeholder="Cauta dupa nume, email sau grup..." dark={dark}/>
                            </div>
                            <ScrollArea className="h-100 mt-2">
                                <div className="px-3 pb-3">
                                    <Table>
                                        <TableHeader><TableRow className="border-0">
                                            <TableHead className={th}>#</TableHead>
                                            <TableHead className={th}>Utilizator</TableHead>
                                            <TableHead className={th}>Grup(uri)</TableHead>
                                            <TableHead className={th}>Permisiune</TableHead>
                                            <TableHead className={th}>Proiecte asignate</TableHead>
                                        </TableRow></TableHeader>
                                        <TableBody>
                                            {filteredTableUsers.length === 0
                                                ? <TableRow><TableCell colSpan={5} className={`text-center py-8 text-sm ${th}`}>Niciun rezultat.</TableCell></TableRow>
                                                : filteredTableUsers.map((u, i) => {
                                                    const userGroups = userGroupsMap.get(u.id) ?? [];
                                                    const userProjects = [...(userProjectsMap.get(u.id)?.values() ?? [])];
                                                    const maxPerm = userGroups.length > 0 ? Math.max(...userGroups.map(g => g.permissionLevel)) : null;
                                                    const permMeta = PERM_OPTIONS.find(p => p.level === maxPerm);
                                                    return (
                                                        <TableRow key={u.id} className={`border-b ${td} ${stripe} transition-colors align-top`}>
                                                            <TableCell className={`${th} text-xs`}>{i+1}</TableCell>
                                                            <TableCell>
                                                                <span className="font-medium">{u.fullName}</span>
                                                                <span className={`block text-xs ${th}`}>{u.email}</span>
                                                            </TableCell>
                                                            <TableCell>
                                                                {userGroups.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {userGroups.map(g => (
                                                                            <span key={g.id} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${dark ? "bg-[#2d2b52] text-[#9b98c8]" : "bg-gray-100 text-gray-600"}`}>{g.name}</span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className={`text-xs italic ${th}`}>fără grup</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {permMeta ? (
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${permMeta.activeCls}`}>{permMeta.label}</span>
                                                                ) : <span className={`text-xs ${th}`}>—</span>}
                                                            </TableCell>
                                                            <TableCell>
                                                                {userProjects.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1 max-w-70">
                                                                        {userProjects.map(p => (
                                                                            <span key={p.id} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${dark ? "bg-[#2d2b52] border-[#3a3768] text-[#9b98c8]" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
                                                                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color || "#524E91" }} />
                                                                                {p.name}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className={`text-xs italic ${th}`}>niciun proiect</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </main>
            </div>
        </div>

        {/* Sheet — creare grup */}
        <Sheet open={sheetOpen} onOpenChange={open => { setSheetOpen(open); if (!open) resetGroupForm(); }}>
            <SheetContent className={`p-0 flex flex-col gap-0 max-w-sm w-full ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200"}`}>
                <SheetHeader className={`px-6 py-5 border-b ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                    <SheetTitle className={`text-base font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Grup nou</SheetTitle>
                    <SheetDescription className={`text-xs ${dark ? "text-[#9b98c8]" : "text-gray-400"}`}>Selecteaza utilizatori si atribuie un nume grupului.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4 px-6 py-5 flex-1 overflow-y-auto">
                    <div className="space-y-1.5">
                        <Label className={`text-xs font-medium ${dark ? "text-[#9b98c8]" : "text-gray-500"}`}>Nume grup</Label>
                        <input
                            autoFocus
                            type="text" value={groupName} onChange={e=>{setGroupName(e.target.value);setCreateError("");}}
                            placeholder="Numele grupului..."
                            onKeyDown={e => e.key === "Enter" && handleCreateGroup()}
                            className={`w-full h-9 px-3 rounded-lg border text-sm outline-none transition-colors
                                ${dark ? "bg-[#2d2b52] border-[#3a3768] text-white placeholder:text-[#6b68a0] focus:border-[#524E91]"
                                       : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#524E91]"}`}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className={`text-xs font-medium ${dark ? "text-[#9b98c8]" : "text-gray-500"}`}>Utilizatori</Label>
                        <SearchInput value={userSearch} onChange={setUserSearch} placeholder="Cauta utilizator..." dark={dark}/>
                        <div className={`rounded-lg border overflow-hidden ${dark?"border-[#3a3768]":"border-gray-200"}`}>
                            {allUsers.length === 0
                                ? <div className={`py-4 text-center text-xs ${dark?"text-[#6b68a0]":"text-gray-400"}`}>Se incarca utilizatorii...</div>
                                : (
                                    <ScrollArea className="h-64">
                                        {filteredUsers.length === 0
                                            ? <div className={`py-4 text-center text-xs ${dark?"text-[#6b68a0]":"text-gray-400"}`}>Niciun utilizator gasit.</div>
                                            : filteredUsers.map(u => {
                                                const sel = selectedUIDs.has(u.id);
                                                const checkId = `ug-${u.id}`;
                                                return (
                                                    <div key={u.id} onClick={() => toggleUser(u.id)}
                                                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b last:border-0
                                                            ${dark ? "border-[#3a3768] hover:bg-[#2d2b52]" : "border-gray-100 hover:bg-gray-50"}
                                                            ${sel ? dark?"bg-[#524E91]/10":"bg-[#524E91]/5" : ""}`}>
                                                        <Checkbox
                                                            id={checkId}
                                                            checked={sel}
                                                            onCheckedChange={() => toggleUser(u.id)}
                                                            onClick={e => e.stopPropagation()}
                                                            className="shrink-0 data-[state=checked]:bg-[#524E91] data-[state=checked]:border-[#524E91]"
                                                        />
                                                        <Label htmlFor={checkId} className="flex flex-col min-w-0 cursor-pointer gap-0" onClick={e => e.preventDefault()}>
                                                            <span className={`text-xs font-medium truncate leading-tight ${dark?"text-white":"text-gray-800"}`}>{u.fullName}</span>
                                                            <span className={`text-[11px] truncate leading-tight ${dark?"text-[#6b68a0]":"text-gray-400"}`}>{u.email}</span>
                                                        </Label>
                                                    </div>
                                                );
                                            })
                                        }
                                    </ScrollArea>
                                )
                            }
                        </div>
                        {selectedUIDs.size > 0 && (
                            <p className={`text-xs ${dark?"text-[#9b98c8]":"text-gray-500"}`}>
                                <span className="font-medium" style={{color:"#524E91"}}>{selectedUIDs.size}</span> utilizator{selectedUIDs.size!==1?"i":""} selectat{selectedUIDs.size!==1?"i":""}
                            </p>
                        )}
                        {createError && <p className="text-xs text-rose-400">{createError}</p>}
                    </div>
                </div>
                <SheetFooter className={`px-6 py-4 border-t ${dark ? "border-[#3a3768]" : "border-gray-100"} flex flex-row gap-2`}>
                    <button type="button" onClick={() => { setSheetOpen(false); resetGroupForm(); }}
                        className={`flex-1 h-9 rounded-lg text-sm border transition-colors ${dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#524E91]/20 hover:text-white" : "border-gray-200 text-gray-600 hover:border-[#524E91] hover:text-[#524E91]"}`}>
                        Anuleaza
                    </button>
                    <button onClick={handleCreateGroup} disabled={creating}
                        className="flex-1 h-9 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                        style={{background:"linear-gradient(135deg,#524E91,#5AC4C2)"}}>
                        {creating ? "Se creeaza..." : "Creeaza grupul"}
                    </button>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <AlertDialog open={!!duplicateGroup} onOpenChange={open => !open && setDuplicateGroup(null)}>
            <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-400/15 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                        </div>
                        <AlertDialogTitle className="text-base">Grup existent</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="pl-12">
                        Grupul{" "}
                        <span className="font-semibold text-foreground">"{duplicateGroup?.name}"</span>{" "}
                        există deja. Vrei să adaugi{" "}
                        <span className="font-semibold text-foreground">
                            {selectedUIDs.size} utilizator{selectedUIDs.size !== 1 ? "i" : ""}
                        </span>{" "}
                        selectat{selectedUIDs.size !== 1 ? "i" : ""} la acest grup?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-2">
                    <AlertDialogCancel onClick={() => setDuplicateGroup(null)}>Anulează</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleAddToExistingGroup}
                        className="text-white border-0"
                        style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}
                    >
                        Adaugă la grup
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
            <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-rose-500/15 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                        </div>
                        <AlertDialogTitle className="text-base">Ștergi grupul?</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="pl-12">
                        Grupul{" "}
                        <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>{" "}
                        și permisiunile asociate vor fi șterse definitiv
                        {deleteTarget?.users?.length > 0 && (
                            <>, iar cei <span className="font-semibold text-foreground">{deleteTarget.users.length}</span> utilizator{deleteTarget.users.length !== 1 ? "i" : ""} din el vor pierde accesul acordat prin acest grup</>
                        )}. Această acțiune este ireversibilă.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-2">
                    <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Anulează</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteGroup} className="bg-red-600 hover:bg-red-500 text-white">
                        Șterge
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
