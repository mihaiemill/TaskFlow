import { useState, useEffect, useMemo } from "react";
import { Topbar } from "../components/ui/Topbar.jsx";
import { Sidebar } from "../components/ui/Sidebar.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
    SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { apiFetch, SearchInput } from "../components/admin/shared.jsx";

// ── UI helpers locale ────────────────────────────────────────────────────────

function Avatar({ name, dark }) {
    return (
        <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}>
            {name?.charAt(0)?.toUpperCase() ?? "?"}
        </div>
    );
}

function MethodBadge({ hasPassword, isGoogleLinked, dark }) {
    if (hasPassword && isGoogleLinked) {
        return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${dark ? "bg-violet-400/10 text-violet-400 border border-violet-400/20" : "bg-violet-50 text-violet-600 border border-violet-200"}`}>Parolă + Google</span>;
    }
    if (isGoogleLinked) {
        return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${dark ? "bg-sky-400/10 text-sky-400 border border-sky-400/20" : "bg-sky-50 text-sky-600 border border-sky-200"}`}>Google</span>;
    }
    return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${dark ? "bg-[#2d2b52] text-[#9b98c8] border border-[#3a3768]" : "bg-gray-100 text-gray-600 border border-gray-200"}`}>Parolă</span>;
}

function ActiveToggle({ active, onChange, disabled, dark }) {
    return (
        <button
            type="button"
            onClick={onChange}
            disabled={disabled}
            title={disabled ? undefined : (active ? "Marcheaza ca inactiv" : "Marcheaza ca activ")}
            className={`inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors shrink-0
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                ${active
                    ? dark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                    : dark ? "bg-gray-500/15 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
            <span className={`relative inline-flex items-center w-6.5 h-3.5 rounded-full transition-colors shrink-0 ${active ? "bg-emerald-500" : dark ? "bg-[#3a3768]" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all ${active ? "left-3.5" : "left-0.5"}`} />
            </span>
            {active ? "Activ" : "Inactiv"}
        </button>
    );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
    const { dark } = useTheme();
    const { token } = useAuth();

    const [projects,     setProjects]     = useState([]);
    const [users,        setUsers]        = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [search,       setSearch]       = useState("");

    // ── sheet: creare user ────────────────────────────────────────────────────
    const [sheetOpen,   setSheetOpen]   = useState(false);
    const [form,        setForm]        = useState({ fullName: "", email: "", password: "" });
    const [creating,    setCreating]    = useState(false);
    const [createError, setCreateError] = useState("");

    // ── dialog: schimbare parola ──────────────────────────────────────────────
    const [passwordTarget, setPasswordTarget] = useState(null);
    const [newPassword,    setNewPassword]    = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordError,  setPasswordError]  = useState("");

    // ── alert dialog: stergere user ───────────────────────────────────────────
    const [deleteTarget,      setDeleteTarget]      = useState(null);
    const [deleteAlsoProjects, setDeleteAlsoProjects] = useState(false);
    const [deleting,          setDeleting]          = useState(false);

    useEffect(() => {
        if (!token) return;
        loadUsers();
        fetch("/api/projects", { headers: { Authorization:`Bearer ${token}` } })
            .then(r => r.ok ? r.json() : Promise.reject()).then(setProjects).catch(console.error);
    }, [token]);

    function loadUsers() {
        setUsersLoading(true);
        fetch("/api/admin/users", { headers: { Authorization:`Bearer ${token}` } })
            .then(r => r.ok ? r.json() : Promise.reject()).then(setUsers).catch(console.error)
            .finally(() => setUsersLoading(false));
    }

    function resetForm() { setForm({ fullName: "", email: "", password: "" }); setCreateError(""); }

    async function handleCreateUser() {
        if (!form.fullName.trim() || !form.email.trim() || !form.password) {
            setCreateError("Completează toate câmpurile.");
            return;
        }
        if (form.password.length < 6) {
            setCreateError("Parola trebuie să aibă cel puțin 6 caractere.");
            return;
        }
        setCreating(true); setCreateError("");
        try {
            const r = await apiFetch("/api/admin/users", token, {
                method: "POST",
                body: JSON.stringify({ fullName: form.fullName.trim(), email: form.email.trim(), password: form.password }),
            });
            if (!r.ok) { const e = await r.json().catch(() => ({})); setCreateError(e.error ?? "Eroare la creare."); return; }
            const newUser = await r.json();
            setUsers(prev => [...prev, newUser].sort((a, b) => a.fullName.localeCompare(b.fullName)));
            setSheetOpen(false);
            resetForm();
        } catch { setCreateError("Eroare de rețea."); }
        finally { setCreating(false); }
    }

    async function toggleActive(user) {
        const nextActive = !user.isActive;
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: nextActive } : u));
        try {
            await apiFetch(`/api/admin/users/${user.id}/status`, token, {
                method: "PATCH",
                body: JSON.stringify({ isActive: nextActive }),
            });
        } catch {
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: user.isActive } : u));
        }
    }

    function openPasswordDialog(user) {
        setPasswordTarget(user); setNewPassword(""); setPasswordError("");
    }

    async function handleChangePassword() {
        if (!passwordTarget) return;
        if (newPassword.length < 6) { setPasswordError("Parola trebuie să aibă cel puțin 6 caractere."); return; }
        setPasswordSaving(true); setPasswordError("");
        try {
            const r = await apiFetch(`/api/admin/users/${passwordTarget.id}/password`, token, {
                method: "PATCH",
                body: JSON.stringify({ newPassword }),
            });
            if (!r.ok) { const e = await r.json().catch(() => ({})); setPasswordError(e.error ?? "Eroare la salvare."); return; }
            setPasswordTarget(null); setNewPassword("");
        } catch { setPasswordError("Eroare de rețea."); }
        finally { setPasswordSaving(false); }
    }

    function openDeleteDialog(user) {
        setDeleteTarget(user); setDeleteAlsoProjects(false);
    }

    async function handleDeleteUser() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const r = await apiFetch(`/api/admin/users/${deleteTarget.id}?deleteProjects=${deleteAlsoProjects}`, token, { method: "DELETE" });
            if (r.ok || r.status === 204) {
                setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
                setDeleteTarget(null);
            }
        } catch { /* ignore */ }
        finally { setDeleting(false); }
    }

    const cardBg = dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200";
    const th     = dark ? "text-[#9b98c8]" : "text-gray-500";
    const td     = dark ? "text-white border-[#3a3768]" : "text-gray-800 border-gray-100";
    const stripe = dark ? "hover:bg-[#524E91]/10" : "hover:bg-[#524E91]/5";
    const inputCls = `w-full h-9 px-3 rounded-lg border text-sm outline-none transition-colors
        ${dark ? "bg-[#2d2b52] border-[#3a3768] text-white placeholder:text-[#6b68a0] focus:border-[#524E91]"
               : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#524E91]"}`;
    const labelCls = `text-xs font-medium ${dark ? "text-[#9b98c8]" : "text-gray-500"}`;

    const filteredUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? users.filter(u => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users;
    }, [users, search]);

    const stats = useMemo(() => ({
        total:    users.length,
        active:   users.filter(u => u.isActive).length,
        inactive: users.filter(u => !u.isActive).length,
        google:   users.filter(u => u.isGoogleLinked).length,
    }), [users]);

    const statCards = [
        { label: "Total utilizatori", value: stats.total,
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        { label: "Activi", value: stats.active,
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
        { label: "Inactivi", value: stats.inactive,
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
        { label: "Conturi Google", value: stats.google,
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
    ];

    return (
        <>
        <div className={`flex h-screen overflow-hidden ${dark ? "bg-[#16152e]" : "bg-gray-50"}`}>
            <Sidebar projects={projects} />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Topbar breadcrumbs={[{ label:"Utilizatori" }]} />

                <main className={`flex-1 overflow-y-auto p-6 sm:p-8 ${dark ? "text-white" : "text-gray-900"}`}>
                    <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap');`}</style>

                    <div className="max-w-6xl mx-auto">

                        {/* header */}
                        <div className="mb-7 flex items-center gap-3">
                            <div className="w-1 h-9 rounded-full shrink-0" style={{background:"linear-gradient(180deg,#524E91,#5AC4C2)"}}/>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2.5">
                                    <h1 className={`text-2xl font-bold leading-tight ${dark?"text-white":"text-gray-900"}`} style={{fontFamily:"'Space Grotesk',sans-serif"}}>
                                        Utilizatori
                                    </h1>
                                    {!usersLoading && users.length > 0 && (
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dark ? "bg-[#2d2b52] text-[#9b98c8]" : "bg-gray-100 text-gray-500"}`}>
                                            {users.length}
                                        </span>
                                    )}
                                </div>
                                <p className={`text-xs mt-1 ${dark?"text-[#6b68a0]":"text-gray-400"}`}>Gestionează conturile — creează, dezactivează vizual sau șterge utilizatori</p>
                            </div>
                            <button onClick={() => setSheetOpen(true)}
                                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 cursor-pointer"
                                style={{background:"linear-gradient(135deg,#524E91,#5AC4C2)"}}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                Utilizator nou
                            </button>
                        </div>

                        {/* ── Mini dashboard ── */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {statCards.map(({ label, value, icon }) => (
                                <div key={label} className={`flex items-center gap-3.5 rounded-2xl border p-4 ${cardBg}`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${dark ? "bg-[#2d2b52] text-[#9b98c8]" : "bg-[#524E91]/10 text-[#524E91]"}`}>
                                        {icon}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-[10px] uppercase tracking-widest font-semibold ${dark?"text-[#6b68a0]":"text-gray-400"}`}>{label}</p>
                                        <p className={`text-xl font-bold leading-tight ${dark?"text-white":"text-gray-900"}`} style={{fontFamily:"'Space Grotesk',sans-serif"}}>
                                            {usersLoading ? <span className={`inline-block w-6 h-5 rounded animate-pulse ${dark?"bg-[#3a3768]":"bg-gray-200"}`}/> : value}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Tabel utilizatori ── */}
                        <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
                            <div className="px-5 pt-4 pb-1">
                                <SearchInput value={search} onChange={setSearch} placeholder="Caută după nume sau email..." dark={dark}/>
                            </div>
                            <ScrollArea className="h-125 mt-2">
                                <div className="px-3 pb-3">
                                    {usersLoading ? (
                                        <div className="flex items-center justify-center py-16">
                                            <div className="w-6 h-6 rounded-full border-2 border-[#524E91] border-t-transparent animate-spin"/>
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader><TableRow className="border-0">
                                                <TableHead className={th}>#</TableHead>
                                                <TableHead className={th}>Utilizator</TableHead>
                                                <TableHead className={th}>Înregistrat</TableHead>
                                                <TableHead className={th}>Metodă</TableHead>
                                                <TableHead className={th}>Proiecte</TableHead>
                                                <TableHead className={th}>Task-uri</TableHead>
                                                <TableHead className={th}>Status</TableHead>
                                                <TableHead className={`${th} text-right`}>Acțiuni</TableHead>
                                            </TableRow></TableHeader>
                                            <TableBody>
                                                {filteredUsers.length === 0
                                                    ? <TableRow><TableCell colSpan={8} className={`text-center py-8 text-sm ${th}`}>Niciun rezultat.</TableCell></TableRow>
                                                    : filteredUsers.map((u, i) => (
                                                        <TableRow key={u.id} className={`border-b ${td} ${stripe} transition-colors`}>
                                                            <TableCell className={`${th} text-xs`}>{i+1}</TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2.5">
                                                                    <Avatar name={u.fullName} dark={dark}/>
                                                                    <div className="min-w-0">
                                                                        <p className="font-medium truncate">{u.fullName}</p>
                                                                        <p className={`text-xs truncate ${th}`}>{u.email}</p>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className={`${th} text-xs whitespace-nowrap`}>{new Date(u.createdAt).toLocaleDateString("ro-RO")}</TableCell>
                                                            <TableCell><MethodBadge hasPassword={u.hasPassword} isGoogleLinked={u.isGoogleLinked} dark={dark}/></TableCell>
                                                            <TableCell className="text-center">{u.projectsCount}</TableCell>
                                                            <TableCell className="text-center">{u.tasksAssignedCount}</TableCell>
                                                            <TableCell>
                                                                <ActiveToggle active={u.isActive} disabled={u.isSelf} onChange={() => toggleActive(u)} dark={dark}/>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center justify-end gap-1">
                                                                    {u.hasPassword ? (
                                                                        <button onClick={() => openPasswordDialog(u)} title="Schimbă parola"
                                                                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${dark?"text-[#6b68a0] hover:text-white hover:bg-[#524E91]/20":"text-gray-400 hover:text-[#524E91] hover:bg-[#524E91]/10"}`}>
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                                                            </svg>
                                                                        </button>
                                                                    ) : (
                                                                        <span title="Cont Google — nu are parolă de schimbat" className={`p-1.5 ${dark?"text-[#3a3768]":"text-gray-200"}`}>
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                                                            </svg>
                                                                        </span>
                                                                    )}
                                                                    {!u.isSelf && (
                                                                        <button onClick={() => openDeleteDialog(u)} title="Șterge utilizatorul"
                                                                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${dark?"text-[#6b68a0] hover:text-rose-400 hover:bg-rose-400/10":"text-gray-300 hover:text-rose-500 hover:bg-rose-50"}`}>
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                                                            </svg>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </main>
            </div>
        </div>

        {/* Sheet — creare utilizator */}
        <Sheet open={sheetOpen} onOpenChange={open => { setSheetOpen(open); if (!open) resetForm(); }}>
            <SheetContent className={`p-0 flex flex-col gap-0 max-w-sm w-full ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200"}`}>
                <SheetHeader className={`px-6 py-5 border-b ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                    <SheetTitle className={`text-base font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Utilizator nou</SheetTitle>
                    <SheetDescription className={`text-xs ${dark ? "text-[#9b98c8]" : "text-gray-400"}`}>Creează un cont nou cu autentificare prin parolă.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4 px-6 py-5 flex-1 overflow-y-auto">
                    <div className="space-y-1.5">
                        <Label className={labelCls}>Nume complet</Label>
                        <input autoFocus type="text" value={form.fullName}
                            onChange={e => { setForm(f => ({ ...f, fullName: e.target.value })); setCreateError(""); }}
                            placeholder="Ion Popescu" className={inputCls}/>
                    </div>
                    <div className="space-y-1.5">
                        <Label className={labelCls}>Email</Label>
                        <input type="email" value={form.email}
                            onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setCreateError(""); }}
                            placeholder="ion@exemplu.com" className={inputCls}/>
                    </div>
                    <div className="space-y-1.5">
                        <Label className={labelCls}>Parolă</Label>
                        <input type="password" value={form.password}
                            onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setCreateError(""); }}
                            onKeyDown={e => e.key === "Enter" && handleCreateUser()}
                            placeholder="Minim 6 caractere" className={inputCls}/>
                    </div>
                    {createError && <p className="text-xs text-rose-400">{createError}</p>}
                </div>
                <SheetFooter className={`px-6 py-4 border-t ${dark ? "border-[#3a3768]" : "border-gray-100"} flex flex-row gap-2`}>
                    <button type="button" onClick={() => { setSheetOpen(false); resetForm(); }}
                        className={`flex-1 h-9 rounded-lg text-sm border transition-colors ${dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#524E91]/20 hover:text-white" : "border-gray-200 text-gray-600 hover:border-[#524E91] hover:text-[#524E91]"}`}>
                        Anulează
                    </button>
                    <button onClick={handleCreateUser} disabled={creating}
                        className="flex-1 h-9 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                        style={{background:"linear-gradient(135deg,#524E91,#5AC4C2)"}}>
                        {creating ? "Se creează..." : "Creează utilizatorul"}
                    </button>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        {/* Dialog — schimbare parola */}
        <Dialog open={!!passwordTarget} onOpenChange={open => !open && setPasswordTarget(null)}>
            <DialogContent className={dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}>
                <DialogHeader>
                    <DialogTitle className={dark ? "text-white" : ""}>Schimbă parola</DialogTitle>
                    <DialogDescription>
                        Setează o parolă nouă pentru <span className="font-semibold text-foreground">{passwordTarget?.fullName}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                    <Label className={labelCls}>Parolă nouă</Label>
                    <input
                        autoFocus
                        type="password"
                        value={newPassword}
                        onChange={e => { setNewPassword(e.target.value); setPasswordError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleChangePassword()}
                        placeholder="Minim 6 caractere"
                        className={inputCls}
                    />
                    {passwordError && <p className="text-xs text-rose-400">{passwordError}</p>}
                </div>
                <DialogFooter>
                    <button type="button" onClick={() => setPasswordTarget(null)}
                        className={`h-9 px-4 rounded-lg text-sm border transition-colors ${dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#524E91]/20 hover:text-white" : "border-gray-200 text-gray-600 hover:border-[#524E91] hover:text-[#524E91]"}`}>
                        Anulează
                    </button>
                    <button onClick={handleChangePassword} disabled={passwordSaving}
                        className="h-9 px-4 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                        style={{background:"linear-gradient(135deg,#524E91,#5AC4C2)"}}>
                        {passwordSaving ? "Se salvează..." : "Salvează parola"}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* AlertDialog — stergere utilizator */}
        <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
            <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-rose-500/15 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                        </div>
                        <AlertDialogTitle className="text-base">Ștergi utilizatorul?</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="pl-12">
                        Contul lui{" "}<span className="font-semibold text-foreground">{deleteTarget?.fullName}</span>{" "}va fi șters definitiv. Această acțiune este ireversibilă.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {deleteTarget?.projectsCount > 0 && (
                    <div className={`ml-12 -mt-1 rounded-lg border p-3 space-y-2 ${dark ? "bg-[#2d2b52] border-[#3a3768]" : "bg-gray-50 border-gray-200"}`}>
                        <p className={`text-xs ${dark ? "text-[#9b98c8]" : "text-gray-600"}`}>
                            Deține <span className="font-semibold text-foreground">{deleteTarget.projectsCount}</span> proiect{deleteTarget.projectsCount !== 1 ? "e" : ""}. Ce vrei să se întâmple cu ele?
                        </p>
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input type="radio" name="deleteProjectsChoice" checked={!deleteAlsoProjects} onChange={() => setDeleteAlsoProjects(false)} className="mt-0.5 accent-[#524E91]"/>
                            <span className={`text-xs ${dark ? "text-white" : "text-gray-800"}`}>Păstrează proiectele — trec în proprietatea administratorului</span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input type="radio" name="deleteProjectsChoice" checked={deleteAlsoProjects} onChange={() => setDeleteAlsoProjects(true)} className="mt-0.5 accent-rose-500"/>
                            <span className={`text-xs ${dark ? "text-white" : "text-gray-800"}`}>Șterge și proiectele, cu tot ce conțin (task-uri, comentarii)</span>
                        </label>
                    </div>
                )}

                <AlertDialogFooter className="mt-2">
                    <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Anulează</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteUser} disabled={deleting} className="bg-red-600 hover:bg-red-500 text-white">
                        {deleting ? "Se șterge..." : "Șterge"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
