import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axiosInstance.js";
import { useTheme } from "../context/ThemeContext.jsx";
import { useSidebarState } from "../context/SidebarContext.jsx";
import { Sidebar } from "../components/ui/Sidebar.jsx";
import { Topbar } from "../components/ui/Topbar.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import { useFavorites } from "../context/FavoritesContext.jsx";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
    SheetDescription, SheetFooter,
} from "../components/ui/sheet.jsx";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog.jsx";

export default function ProjectsPage() {
    const [projects, setProjects] = useState([]);
    const { sidebarOpen } = useSidebarState();

    // Create
    const [sheetOpen, setSheetOpen] = useState(false);
    const [form, setForm] = useState({ name: "", description: "", color: "#524E91" });
    const [creating, setCreating] = useState(false);
    const [duplicateProjectName, setDuplicateProjectName] = useState(null);

    // Edit
    const [editSheetOpen, setEditSheetOpen] = useState(false);
    const [editProject, setEditProject] = useState(null);
    const [updating, setUpdating] = useState(false);

    // Delete
    const [deleteProjectId, setDeleteProjectId] = useState(null);

    const { dark } = useTheme();
    const { isFavorite, toggleFavorite, removeFavorite } = useFavorites();

    useEffect(() => {
        api.get("/projects").then(r => setProjects(r.data));
    }, []);

    const resetForm = () => setForm({ name: "", description: "", color: "#524E91" });

    // ── Create ──────────────────────────────────────────────
    const handleCreate = async () => {
        if (!form.name.trim()) return;
        const duplicate = projects.find(p => p.name.trim().toLowerCase() === form.name.trim().toLowerCase());
        if (duplicate) { setDuplicateProjectName(form.name.trim()); return; }
        await doCreate();
    };

    const doCreate = async () => {
        setCreating(true);
        try {
            const { data } = await api.post("/projects", form);
            setProjects(p => [...p, data]);
            setSheetOpen(false);
            resetForm();
        } finally { setCreating(false); }
    };

    // ── Update ──────────────────────────────────────────────
    const handleUpdate = async () => {
        if (!editProject || !editProject.name.trim()) return;
        setUpdating(true);
        try {
            const { data } = await api.put(`/projects/${editProject.id}`, {
                name: editProject.name,
                description: editProject.description,
                color: editProject.color,
            });
            setProjects(p => p.map(proj => proj.id === data.id ? { ...data, remainingTasks: proj.remainingTasks, totalTasks: proj.totalTasks } : proj));
            setEditSheetOpen(false);
            setEditProject(null);
        } finally { setUpdating(false); }
    };

    // ── Delete ──────────────────────────────────────────────
    const handleDeleteProject = async () => {
        if (!deleteProjectId) return;
        const idToDelete = deleteProjectId;
        setDeleteProjectId(null);
        try {
            // cleanup favorite taskuri — non-blocking, nu blochează delete-ul
            try {
                const { data: tasks } = await api.get(`/projects/${idToDelete}/tasks`);
                tasks.forEach(t => removeFavorite('task', t.id));
            } catch { /* endpoint inexistent sau eroare — ignoră, taskurile se șterg oricum în cascade */ }

            removeFavorite('project', idToDelete);
            await api.delete(`/projects/${idToDelete}`);
            setProjects(p => p.filter(proj => proj.id !== idToDelete));
        } catch (err) {
            console.error("Delete project failed:", err);
        }
    };

    const inputCls = `h-9 text-sm ${dark
        ? "bg-[#2d2b52] border-[#3a3768] text-white placeholder:text-[#6b68a0] focus:border-[#524E91]"
        : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#524E91]"}`;
    const labelCls = `text-xs font-medium ${dark ? "text-[#9b98c8]" : "text-gray-500"}`;

    return (
        <div className={`flex h-screen overflow-hidden ${dark ? "" : "bg-linear-to-br from-[#f0efff] via-white to-[#e8fafa]"}`}
             style={dark ? { background: "linear-gradient(135deg, #13112a 0%, #1e1c3a 60%, #0f2a2a 100%)" } : {}}
        >
            <Sidebar projects={projects} />

            <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ${sidebarOpen ? "md:ml-0" : ""}`}>
                <Topbar
                    breadcrumbs={[{ label: "Proiectele mele" }]}
                />

                <main className="flex-1 p-4 sm:p-7 overflow-y-auto">
                    {projects.length === 0 && (
                        <div className="flex flex-col items-center justify-center pt-20 text-center">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${dark ? "bg-[#2d2b52]" : "bg-[#524E91]/10"}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" style={{ color: "#524E91" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                                </svg>
                            </div>
                            <p className={`text-sm ${dark ? "text-[#9b98c8]" : "text-gray-500"}`}>Niciun proiect. Creează primul tău proiect.</p>
                        </div>
                    )}

                    {projects.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {projects.map(p => {
                                const perm      = p.myPermission ?? 1;
                                const canEdit   = perm >= 2;
                                const canDelete = perm >= 3;
                                const btnCount  = 1 + (canEdit ? 1 : 0) + (canDelete ? 1 : 0);
                                const prCls     = btnCount === 3 ? "pr-24" : btnCount === 2 ? "pr-17" : "pr-10";
                                const favorited = isFavorite("project", p.id);

                                return (
                                    <div key={p.id} className="relative group">
                                        <Link to={`/projects/${p.id}`} className="no-underline block h-full">
                                            <Card
                                                className={`h-full hover:-translate-y-0.5 transition-all duration-150 cursor-pointer
                                                    ${dark ? "border-[#3a3768] bg-[#1e1c3a]/80 hover:bg-[#2d2b52]/80" : "border-gray-200 bg-white hover:bg-gray-50 shadow-sm hover:shadow-md"}`}
                                                style={{ borderLeft: `3px solid ${p.color || "#524E91"}` }}
                                            >
                                                <CardContent className={`p-5 min-h-27.5 flex flex-col justify-between ${prCls}`}>
                                                    <div>
                                                        <h3 className={`font-semibold text-sm mb-1.5 ${dark ? "text-white" : "text-gray-900"}`}>{p.name}</h3>
                                                        {p.description && <p className={`text-xs mb-3 leading-relaxed ${dark ? "text-[#9b98c8]" : "text-gray-500"}`}>{p.description}</p>}
                                                    </div>
                                                    <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: p.color || "#524E91" }}>
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color || "#524E91" }} />
                                                        {p.remainingTasks ?? 0} taskuri rămase
                                                    </span>
                                                </CardContent>
                                            </Card>
                                        </Link>

                                        {/* Buton favorite — mereu vizibil, indiferent de permisiune */}
                                        <button
                                            onClick={e => { e.preventDefault(); toggleFavorite({ type: "project", id: p.id, name: p.name, color: p.color }); }}
                                            title={favorited ? "Elimină din favorite" : "Adaugă la favorite"}
                                            className={`absolute top-3 right-3 p-1.5 rounded-md transition-colors duration-150 cursor-pointer hover:bg-amber-400/10
                                                ${favorited ? "text-amber-400" : dark ? "text-[#6b68a0] hover:text-amber-400" : "text-gray-400 hover:text-amber-500"}`}
                                        >
                                            {favorited ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                </svg>
                                            )}
                                        </button>

                                        {/* Buton edit — Modificare (>=2) */}
                                        {canEdit && (
                                            <button
                                                onClick={e => { e.preventDefault(); setEditProject({ ...p }); setEditSheetOpen(true); }}
                                                title="Editează proiect"
                                                className={`absolute top-3 right-10 p-1.5 rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-150 cursor-pointer hover:text-[#524E91] hover:bg-[#524E91]/10 ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                            </button>
                                        )}

                                        {/* Buton delete — Stergere (>=3) */}
                                        {canDelete && (
                                            <button
                                                onClick={e => { e.preventDefault(); setDeleteProjectId(p.id); }}
                                                title="Șterge proiect"
                                                className={`absolute top-3 right-17 p-1.5 rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-150 cursor-pointer hover:text-red-400 hover:bg-red-500/10 ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>

            {/* FAB — creare proiect */}
            <button
                onClick={() => setSheetOpen(true)}
                title="Proiect nou"
                className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-all duration-150 hover:scale-105 cursor-pointer z-50 hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)", boxShadow: "0 4px 20px rgba(82,78,145,0.4)" }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>

            {/* Sheet — creare */}
            <Sheet open={sheetOpen} onOpenChange={open => { setSheetOpen(open); if (!open) resetForm(); }}>
                <SheetContent className={`p-0 flex flex-col gap-0 max-w-sm w-full ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200"}`}>
                    <SheetHeader className={`px-6 py-5 border-b ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                        <SheetTitle className={`text-base font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Proiect nou</SheetTitle>
                        <SheetDescription className={`text-xs ${dark ? "text-[#9b98c8]" : "text-gray-400"}`}>Completează detaliile și apasă Salvează.</SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col gap-4 px-6 py-5 flex-1 overflow-y-auto">
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Nume</Label>
                            <Input autoFocus placeholder="Nume proiect" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleCreate()} className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Descriere</Label>
                            <Input placeholder="Descriere (opțional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Culoare</Label>
                            <div className={`flex items-center gap-3 h-9 px-3 rounded-md border ${dark ? "bg-[#2d2b52] border-[#3a3768]" : "bg-gray-50 border-gray-200"}`}>
                                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                                <span className={`text-sm font-mono ${dark ? "text-[#9b98c8]" : "text-gray-500"}`}>{form.color}</span>
                                <span className="ml-auto w-4 h-4 rounded-full shrink-0" style={{ background: form.color }} />
                            </div>
                        </div>
                    </div>
                    <SheetFooter className={`px-6 py-4 border-t ${dark ? "border-[#3a3768]" : "border-gray-100"} flex flex-row gap-2`}>
                        <Button variant="outline" onClick={() => setSheetOpen(false)} className={`flex-1 h-9 text-sm ${dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#524E91]/20 hover:text-white" : "border-gray-200 text-gray-600 hover:border-[#524E91] hover:text-[#524E91]"}`}>Anulează</Button>
                        <Button onClick={handleCreate} disabled={creating || !form.name.trim()} className="flex-1 h-9 text-sm text-white font-semibold hover:opacity-90" style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}>
                            {creating ? "Se salvează..." : "Salvează"}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Sheet — editare */}
            <Sheet open={editSheetOpen} onOpenChange={open => { setEditSheetOpen(open); if (!open) setEditProject(null); }}>
                <SheetContent className={`p-0 flex flex-col gap-0 max-w-sm w-full ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200"}`}>
                    <SheetHeader className={`px-6 py-5 border-b ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                        <SheetTitle className={`text-base font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Editează proiect</SheetTitle>
                        <SheetDescription className={`text-xs ${dark ? "text-[#9b98c8]" : "text-gray-400"}`}>Modifică detaliile și apasă Salvează.</SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col gap-4 px-6 py-5 flex-1 overflow-y-auto">
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Nume</Label>
                            <Input
                                autoFocus
                                placeholder="Nume proiect"
                                value={editProject?.name ?? ""}
                                onChange={e => setEditProject(p => ({ ...p, name: e.target.value }))}
                                onKeyDown={e => e.key === "Enter" && handleUpdate()}
                                className={inputCls}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Descriere</Label>
                            <Input
                                placeholder="Descriere (opțional)"
                                value={editProject?.description ?? ""}
                                onChange={e => setEditProject(p => ({ ...p, description: e.target.value }))}
                                className={inputCls}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Culoare</Label>
                            <div className={`flex items-center gap-3 h-9 px-3 rounded-md border ${dark ? "bg-[#2d2b52] border-[#3a3768]" : "bg-gray-50 border-gray-200"}`}>
                                <input
                                    type="color"
                                    value={editProject?.color ?? "#524E91"}
                                    onChange={e => setEditProject(p => ({ ...p, color: e.target.value }))}
                                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                                />
                                <span className={`text-sm font-mono ${dark ? "text-[#9b98c8]" : "text-gray-500"}`}>{editProject?.color}</span>
                                <span className="ml-auto w-4 h-4 rounded-full shrink-0" style={{ background: editProject?.color }} />
                            </div>
                        </div>
                    </div>
                    <SheetFooter className={`px-6 py-4 border-t ${dark ? "border-[#3a3768]" : "border-gray-100"} flex flex-row gap-2`}>
                        <Button variant="outline" onClick={() => setEditSheetOpen(false)} className={`flex-1 h-9 text-sm ${dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#524E91]/20 hover:text-white" : "border-gray-200 text-gray-600 hover:border-[#524E91] hover:text-[#524E91]"}`}>Anulează</Button>
                        <Button onClick={handleUpdate} disabled={updating || !editProject?.name?.trim()} className="flex-1 h-9 text-sm text-white font-semibold hover:opacity-90" style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}>
                            {updating ? "Se salvează..." : "Salvează"}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Dialog — stergere */}
            <AlertDialog open={!!deleteProjectId} onOpenChange={open => !open && setDeleteProjectId(null)}>
                <AlertDialogContent className={dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className={dark ? "text-white" : ""}>Ștergi proiectul?</AlertDialogTitle>
                        <AlertDialogDescription>Această acțiune este ireversibilă. Proiectul și toate taskurile asociate vor fi șterse definitiv.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className={dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#2d2b52]" : ""}>Anulează</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteProject} className="bg-red-600 hover:bg-red-500 text-white">Șterge</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Dialog — duplicat */}
            <AlertDialog open={!!duplicateProjectName} onOpenChange={open => !open && setDuplicateProjectName(null)}>
                <AlertDialogContent className={dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className={dark ? "text-white" : ""}>Proiect cu același nume</AlertDialogTitle>
                        <AlertDialogDescription>Există deja un proiect numit „{duplicateProjectName}". Vrei să îl adaugi oricum?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDuplicateProjectName(null)} className={dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#2d2b52]" : ""}>Anulează</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { setDuplicateProjectName(null); doCreate(); }} className="text-white hover:opacity-90" style={{ background: "#524E91" }}>Adaugă oricum</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
