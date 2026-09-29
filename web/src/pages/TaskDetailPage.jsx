import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AlignLeft, MessageSquare, SlidersHorizontal, Tag as TagIcon, CalendarDays, Clock, Flag, FolderOpen, Send, Plus, X, Check, Loader2, ChevronLeft, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import api from "../api/axiosInstance.js";
import { useTheme } from "../context/ThemeContext.jsx";
import { useFavorites } from "../context/FavoritesContext.jsx";
import { useProjects } from "../context/ProjectsContext.jsx";
import { Sidebar } from "../components/ui/Sidebar.jsx";
import { Topbar } from "../components/ui/Topbar.jsx";
import { TaskGallery } from "../components/TaskGallery.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import PrioritySelect from "../components/PrioritySelect.jsx";
import { Calendar } from "../components/ui/calendar.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover.jsx";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from "../components/ui/dialog.jsx";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog.jsx";

const PRIORITY_MAP = {
    High:   { label: "High",   dot: "bg-red-500",   badge: { dark: "bg-red-500/10 text-red-400 border border-red-500/20",     light: "bg-red-50 text-red-600 border border-red-200" } },
    Medium: { label: "Medium", dot: "bg-amber-400", badge: { dark: "bg-amber-400/10 text-amber-400 border border-amber-400/20", light: "bg-amber-50 text-amber-600 border border-amber-200" } },
    Low:    { label: "Low",    dot: "bg-green-500", badge: { dark: "bg-green-500/10 text-green-400 border border-green-500/20", light: "bg-green-50 text-green-600 border border-green-200" } },
};

const STATUS_MAP = {
    Todo:       { label: "De făcut",   dot: "bg-[#9b98c8]",   badge: { dark: "bg-[#2d2b52] text-[#9b98c8] border border-[#3a3768]",            light: "bg-gray-100 text-gray-600 border border-gray-300" } },
    InProgress: { label: "În progres", dot: "bg-[#5AC4C2]",   badge: { dark: "bg-[#5AC4C2]/10 text-[#5AC4C2] border border-[#5AC4C2]/20",      light: "bg-[#5AC4C2]/10 text-[#3a9b9a] border border-[#5AC4C2]/30" } },
    Done:       { label: "Finalizat",  dot: "bg-emerald-500", badge: { dark: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20", light: "bg-emerald-50 text-emerald-600 border border-emerald-200" } },
};

const initials = (name = "") => name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("") || "?";

export default function TaskDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [tags, setTags] = useState([]);
    const { projects, refreshProjects } = useProjects();
    const [comment, setComment] = useState("");
    const [sendingComment, setSendingComment] = useState(false);
    const { dark } = useTheme();
    const { removeFavorite, updateFavorite } = useFavorites();

    // Tag inline create
    const [newTagOpen, setNewTagOpen] = useState(false);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#524E91");
    const [savingTag, setSavingTag] = useState(false);
    const [showAllTags, setShowAllTags] = useState(false);

    const [editOpen, setEditOpen]         = useState(false);
    const [editForm, setEditForm]         = useState({ title: "", description: "", priority: 1, dueDate: "" });
    const [editSaving, setEditSaving]     = useState(false);
    const [editCalendarOpen, setEditCalendarOpen] = useState(false);
    const [duplicateEditTaskName, setDuplicateEditTaskName] = useState(null);

    useEffect(() => {
        api.get(`/tasks/${id}`)
            .then(r => setTask(r.data))
            .catch(err => {
                if (err.response?.status === 404) {
                    removeFavorite('task', id);
                    navigate('/projects');
                }
            });
        api.get("/tags").then(r => setTags(r.data));
        refreshProjects();
    }, [id]);

    // Tine la zi numele task-ului (si al proiectului lui) in favorite, oriunde ar fi fost redenumite
    useEffect(() => {
        if (!task) return;
        const taskProject = projects.find(p => p.id === task.projectId);
        updateFavorite("task", task.id, {
            name: task.title,
            projectId: task.projectId,
            ...(taskProject ? { projectName: taskProject.name } : {}),
        });
        if (taskProject) updateFavorite("project", taskProject.id, { name: taskProject.name, color: taskProject.color });
    }, [task, projects, updateFavorite]);

    // Proiectul taskului poate lipsi din lista din sidebar (ex. adminul deschide taskul altui
    // utilizator din dashboard) — atunci îl cerem direct, ca să avem numele și myPermission.
    const [extraProject, setExtraProject] = useState(null);
    const taskProjectId = task?.projectId;
    const inProjectList = projects.some(p => p.id === taskProjectId);
    useEffect(() => {
        if (!taskProjectId || inProjectList || extraProject?.id === taskProjectId) return;
        api.get(`/projects/${taskProjectId}`).then(r => setExtraProject(r.data)).catch(() => {});
    }, [taskProjectId, inProjectList, extraProject?.id]);

    const handleStatusChange = async (status) => {
        if (status === task.status) return;
        const statusMap = { "Todo": 0, "InProgress": 1, "Done": 2 };
        const { data } = await api.patch(`/tasks/${id}/status`, { status: statusMap[status] });
        setTask(data);
    };

    const handleAddTag = async (tagId) => {
        await api.post(`/tasks/${id}/tags/${tagId}`);
        const { data } = await api.get(`/tasks/${id}`);
        setTask(data);
    };

    const handleRemoveTag = async (tagId) => {
        await api.delete(`/tasks/${id}/tags/${tagId}`);
        const { data } = await api.get(`/tasks/${id}`);
        setTask(data);
    };

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;
        setSavingTag(true);
        try {
            const { data: tag } = await api.post("/tags", { name: newTagName.trim(), color: newTagColor });
            await api.post(`/tasks/${id}/tags/${tag.id}`);
            const { data: updatedTask } = await api.get(`/tasks/${id}`);
            setTask(updatedTask);
            setTags(prev => [...prev, tag]);
            setNewTagName("");
            setNewTagColor("#524E91");
            setNewTagOpen(false);
        } finally { setSavingTag(false); }
    };

    const openEditTask = () => {
        setEditForm({
            title: task.title,
            description: task.description || "",
            priority: task.priority === "High" ? 2 : task.priority === "Medium" ? 1 : 0,
            dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
        });
        setEditOpen(true);
    };

    const closeEditTask = () => { setEditOpen(false); setEditCalendarOpen(false); };

    const handleEditSave = async () => {
        if (!editForm.title.trim()) return;
        const { data: projectTasks } = await api.get(`/projects/${task.projectId}/tasks`);
        const duplicate = projectTasks.find(t => t.id !== task.id && t.title.trim().toLowerCase() === editForm.title.trim().toLowerCase());
        if (duplicate) { setDuplicateEditTaskName(editForm.title.trim()); return; }
        await doEditSave();
    };

    const doEditSave = async () => {
        setEditSaving(true);
        try {
            const payload = { ...editForm, dueDate: editForm.dueDate || null };
            const { data } = await api.put(`/tasks/${id}`, payload);
            setTask(t => ({ ...t, ...data }));
            closeEditTask();
        } finally { setEditSaving(false); }
    };

    const handleAddComment = async () => {
        if (!comment.trim()) return;
        setSendingComment(true);
        try {
            const { data } = await api.post(`/tasks/${id}/comments`, { text: comment });
            setTask(t => ({ ...t, comments: [...t.comments, data] }));
            setComment("");
        } finally { setSendingComment(false); }
    };

    const pageBg = dark ? "" : "bg-linear-to-br from-[#f0efff] via-white to-[#e8fafa]";
    const pageStyle = dark ? { background: "linear-gradient(135deg, #13112a 0%, #1e1c3a 60%, #0f2a2a 100%)" } : {};

    if (!task) return (
        <div className={`flex h-screen overflow-hidden ${pageBg}`} style={pageStyle}>
            <Sidebar projects={projects} />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Topbar breadcrumbs={[{ label: "Proiecte", to: "/projects" }, { label: "..." }]} />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className={`w-6 h-6 animate-spin ${dark ? "text-[#9b98c8]" : "text-[#524E91]"}`} />
                </main>
            </div>
        </div>
    );

    const availableTags = tags.filter(t => !task.tags.find(tt => tt.id === t.id));
    const visibleTags = showAllTags ? availableTags : availableTags.slice(0, 10);
    const prio = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.Low;
    const status = STATUS_MAP[task.status] ?? STATUS_MAP.Todo;
    const taskProject = projects.find(p => p.id === task.projectId)
        ?? (extraProject?.id === task.projectId ? extraProject : undefined);
    const isOverdue = task.dueDate && task.status !== "Done" && new Date(task.dueDate) < new Date(new Date().toDateString());

    // ─── Permisiuni ───────────────────────────────────────────────────────────
    // myPermission: 1=Vizualizare, 2=Modificare, 3=Ștergere
    // fallback 1 — fără grup asignat = doar vizualizare
    const myPerm    = taskProject?.myPermission ?? 1;
    const canModify = myPerm >= 2;
    // ─────────────────────────────────────────────────────────────────────────

    const cardCls  = `backdrop-blur-sm ${dark ? "border-[#3a3768] bg-[#1e1c3a]/80" : "border-gray-200 bg-white/90 shadow-sm"}`;
    const muted    = dark ? "text-[#6b68a0]" : "text-gray-400";
    const soft     = dark ? "text-[#9b98c8]" : "text-gray-600";
    const strong   = dark ? "text-white" : "text-gray-900";
    const divider  = dark ? "border-[#3a3768]" : "border-gray-100";
    const iconTile = dark ? "bg-[#2d2b52] text-[#9b98c8]" : "bg-[#524E91]/10 text-[#524E91]";

    const inputCls = `h-9 text-sm ${dark
        ? "bg-[#2d2b52] border-[#3a3768] text-white placeholder:text-[#6b68a0] focus:border-[#524E91]"
        : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#524E91]"}`;
    const labelCls = `text-xs font-medium ${dark ? "text-[#9b98c8]" : "text-gray-500"}`;

    const SectionHeader = ({ icon: Icon, title, count, children }) => (
        <div className="flex items-center gap-2.5 mb-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconTile}`}>
                <Icon className="w-4 h-4" />
            </div>
            <h2 className={`text-sm font-semibold ${strong}`}>{title}</h2>
            {count > 0 && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dark ? "bg-[#2d2b52] text-[#9b98c8]" : "bg-gray-100 text-gray-500"}`}>{count}</span>
            )}
            {children}
        </div>
    );

    const DetailRow = ({ icon: Icon, label, children }) => (
        <div className={`flex items-center justify-between gap-3 py-2.5 border-b last:border-0 ${divider}`}>
            <span className={`flex items-center gap-2 text-xs ${muted}`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
            </span>
            <span className="text-xs font-medium text-right min-w-0">{children}</span>
        </div>
    );

    return (
        <div className={`flex h-screen overflow-hidden ${pageBg}`} style={pageStyle}>
            <Sidebar projects={projects} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Topbar
                    breadcrumbs={[
                        { label: "Proiecte", to: "/projects" },
                        { label: taskProject?.name ?? "Proiect", to: `/projects/${task.projectId}` },
                        { label: task.title },
                    ]}
                />

                <main className="flex-1 p-4 sm:p-7 overflow-y-auto">
                    <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap');`}</style>

                    <div className="max-w-6xl mx-auto">

                        {/* Buton back */}
                        <button
                            onClick={() => navigate(`/projects/${task.projectId}`)}
                            className={`flex items-center gap-1 text-xs font-medium w-fit mb-4 transition-colors duration-150 cursor-pointer ${dark ? "text-[#9b98c8] hover:text-white" : "text-[#524E91] hover:text-[#3d3a6e]"}`}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Înapoi la {taskProject?.name ?? "proiect"}
                        </button>

                        {/* ── Header ── */}
                        <div className="mb-7 flex items-start gap-3">
                            <div className="w-1 self-stretch min-h-9 rounded-full shrink-0" style={{ background: "linear-gradient(180deg,#524E91,#5AC4C2)" }} />
                            <div className="flex-1 min-w-0">
                                <h1 className={`text-2xl sm:text-[28px] font-bold leading-tight wrap-break-word ${strong}`} style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                                    {task.title}
                                </h1>
                                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${dark ? status.badge.dark : status.badge.light}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{status.label}
                                    </span>
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${dark ? prio.badge.dark : prio.badge.light}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />{prio.label}
                                    </span>
                                    {task.dueDate && (
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                                            isOverdue
                                                ? dark ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-rose-50 text-rose-600 border-rose-200"
                                                : dark ? "border-[#3a3768] text-[#9b98c8]" : "border-gray-200 text-gray-500 bg-white/60"
                                        }`}>
                                            <CalendarDays className="w-3 h-3" />
                                            {new Date(task.dueDate).toLocaleDateString("ro-RO")}{isOverdue && " · depășit"}
                                        </span>
                                    )}
                                    {taskProject && (
                                        <Link to={`/projects/${task.projectId}`}
                                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border transition-colors ${dark ? "border-[#3a3768] text-[#9b98c8] hover:border-[#524E91] hover:text-white" : "border-gray-200 text-gray-500 bg-white/60 hover:border-[#524E91] hover:text-[#524E91]"}`}>
                                            <span className="w-2 h-2 rounded-full" style={{ background: taskProject.color || "#524E91" }} />
                                            {taskProject.name}
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

                            {/* ── Coloana principală ── */}
                            <div className="lg:col-span-2 flex flex-col gap-5 min-w-0">

                                {/* Descriere */}
                                <section className={`rounded-2xl border p-5 ${cardCls}`}>
                                    <SectionHeader icon={AlignLeft} title="Descriere" />
                                    {task.description ? (
                                        <p className={`text-sm leading-relaxed whitespace-pre-line ${soft}`}>{task.description}</p>
                                    ) : (
                                        <p className={`text-sm italic ${muted}`}>Nicio descriere adăugată.</p>
                                    )}
                                </section>

                                {/* Imagini */}
                                <TaskGallery
                                    task={task}
                                    onImagesChange={images => setTask(t => ({ ...t, images }))}
                                    canModify={canModify}
                                    dark={dark}
                                    cardCls={cardCls}
                                />

                                {/* Comentarii */}
                                <section className={`rounded-2xl border p-5 ${cardCls}`}>
                                    <SectionHeader icon={MessageSquare} title="Comentarii" count={task.comments.length} />

                                    <div className="flex flex-col gap-4">
                                        {task.comments.length === 0 && (
                                            <div className="flex flex-col items-center justify-center text-center gap-1.5 py-6">
                                                <MessageSquare className={`w-6 h-6 ${muted}`} />
                                                <p className={`text-sm ${muted}`}>Niciun comentariu încă.</p>
                                            </div>
                                        )}
                                        {task.comments.map(c => (
                                            <div key={c.id} className="flex gap-3">
                                                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white" style={{ background: "linear-gradient(135deg,#524E91,#5AC4C2)" }}>
                                                    {initials(c.authorName)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                                                        <span className={`text-xs font-semibold ${strong}`}>{c.authorName}</span>
                                                        <span className={`text-[11px] ${muted}`}>{new Date(c.createdAt).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" })}</span>
                                                    </div>
                                                    <div className={`rounded-xl rounded-tl-sm px-3.5 py-2.5 text-sm wrap-break-word ${dark ? "bg-[#2d2b52] text-white" : "bg-gray-50 border border-gray-100 text-gray-800"}`}>
                                                        {c.text}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Input comentariu — doar cu permisiune >= 2 */}
                                    {canModify && (
                                        <div className={`mt-5 pt-4 border-t ${divider}`}>
                                            <div className={`flex items-center gap-2 rounded-xl border pl-3.5 pr-1.5 py-1.5 transition-colors focus-within:border-[#524E91] ${dark ? "bg-[#2d2b52] border-[#3a3768]" : "bg-gray-50 border-gray-200"}`}>
                                                <input
                                                    value={comment}
                                                    onChange={e => setComment(e.target.value)}
                                                    onKeyDown={e => e.key === "Enter" && handleAddComment()}
                                                    placeholder="Scrie un comentariu..."
                                                    className={`flex-1 min-w-0 h-8 bg-transparent text-sm outline-none ${dark ? "text-white placeholder:text-[#6b68a0]" : "text-gray-900 placeholder:text-gray-400"}`}
                                                />
                                                <button
                                                    onClick={handleAddComment}
                                                    disabled={sendingComment || !comment.trim()}
                                                    title="Trimite"
                                                    className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                                    style={{ background: "linear-gradient(135deg,#524E91,#5AC4C2)" }}
                                                >
                                                    {sendingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                    <span className="hidden sm:inline">Trimite</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </div>

                            {/* ── Panou lateral ── */}
                            <aside className="flex flex-col gap-5 lg:sticky lg:top-0">

                                {/* Detalii */}
                                <section className={`rounded-2xl border p-5 ${cardCls}`}>
                                    <SectionHeader icon={SlidersHorizontal} title="Detalii">
                                        {canModify && (
                                            <button
                                                onClick={openEditTask}
                                                title="Editează task"
                                                className={`ml-auto p-1 rounded transition-colors hover:text-[#524E91] hover:bg-[#524E91]/10 cursor-pointer ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                                </svg>
                                            </button>
                                        )}
                                    </SectionHeader>

                                    <p className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${muted}`}>Status</p>
                                    {canModify ? (
                                        <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl mb-4 ${dark ? "bg-[#13112a]/60" : "bg-gray-100"}`}>
                                            {Object.entries(STATUS_MAP).map(([key, s]) => {
                                                const active = task.status === key;
                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => handleStatusChange(key)}
                                                        className={`flex items-center justify-center gap-1.5 h-8 px-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                                            active
                                                                ? dark ? "bg-[#2d2b52] text-white shadow-sm" : "bg-white text-gray-900 shadow-sm"
                                                                : dark ? "text-[#6b68a0] hover:text-[#9b98c8]" : "text-gray-400 hover:text-gray-600"
                                                        }`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? s.dot : dark ? "bg-[#3a3768]" : "bg-gray-300"}`} />
                                                        <span className="truncate">{s.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full mb-4 ${dark ? status.badge.dark : status.badge.light}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{status.label}
                                        </span>
                                    )}

                                    <div>
                                        <DetailRow icon={Flag} label="Prioritate">
                                            <span className={`inline-flex items-center gap-1.5 ${soft}`}>
                                                <span className={`w-2 h-2 rounded-full ${prio.dot}`} />{prio.label}
                                            </span>
                                        </DetailRow>
                                        <DetailRow icon={CalendarDays} label="Termen">
                                            {task.dueDate
                                                ? <span className={isOverdue ? "text-rose-500" : soft}>{new Date(task.dueDate).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })}</span>
                                                : <span className={muted}>—</span>}
                                        </DetailRow>
                                        <DetailRow icon={Clock} label="Creat">
                                            <span className={soft}>{new Date(task.createdAt).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })}</span>
                                        </DetailRow>
                                        <DetailRow icon={FolderOpen} label="Proiect">
                                            <span className={`inline-flex items-center gap-1.5 truncate ${soft}`}>
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: taskProject?.color || "#524E91" }} />
                                                <span className="truncate">{taskProject?.name ?? "—"}</span>
                                            </span>
                                        </DetailRow>
                                    </div>
                                </section>

                                {/* Taguri */}
                                <section className={`rounded-2xl border p-5 ${cardCls}`}>
                                    <SectionHeader icon={TagIcon} title="Taguri" count={task.tags.length} />

                                    {/* Taguri existente pe task */}
                                    <div className="flex gap-1.5 flex-wrap">
                                        {task.tags.map(t => (
                                            canModify ? (
                                                <button key={t.id} onClick={() => handleRemoveTag(t.id)} title="Scoate tagul"
                                                    className="group flex items-center gap-1 text-xs font-medium pl-2.5 pr-2 py-1 rounded-full text-white transition-opacity hover:opacity-80 cursor-pointer"
                                                    style={{ background: t.color }}>
                                                    {t.name}
                                                    <X className="w-3 h-3 opacity-60 group-hover:opacity-100" strokeWidth={2.5} />
                                                </button>
                                            ) : (
                                                <span key={t.id} className="text-xs font-medium px-2.5 py-1 rounded-full text-white" style={{ background: t.color }}>
                                                    {t.name}
                                                </span>
                                            )
                                        ))}
                                        {task.tags.length === 0 && <p className={`text-sm italic ${muted}`}>Niciun tag adăugat.</p>}
                                    </div>

                                    {canModify && (
                                        <div className={`mt-4 pt-4 border-t ${divider}`}>
                                            {/* Taguri disponibile */}
                                            {!newTagOpen && availableTags.length > 0 && (
                                                <>
                                                    <p className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${muted}`}>Adaugă</p>
                                                    <div className="flex gap-1.5 flex-wrap mb-3">
                                                        {visibleTags.map(t => (
                                                            <button key={t.id} onClick={() => handleAddTag(t.id)}
                                                                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all hover:opacity-80 cursor-pointer ${dark ? "text-[#9b98c8]" : "text-gray-600"}`}
                                                                style={{ borderColor: t.color + "60" }}>
                                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                                                                {t.name}
                                                            </button>
                                                        ))}
                                                        {availableTags.length > 10 && (
                                                            <button
                                                                onClick={() => setShowAllTags(v => !v)}
                                                                className={`text-xs font-medium px-2.5 py-1 rounded-full border border-dashed transition-all cursor-pointer ${dark ? "border-[#3a3768] text-[#6b68a0] hover:border-[#524E91] hover:text-[#9b98c8]" : "border-gray-300 text-gray-400 hover:border-[#524E91] hover:text-[#524E91]"}`}>
                                                                {showAllTags ? "Mai puține" : `+${availableTags.length - 10} altele`}
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {/* Inline create new tag */}
                                            {newTagOpen ? (
                                                <div className={`flex items-center gap-2 p-2 rounded-xl border ${dark ? "bg-[#2d2b52] border-[#3a3768]" : "bg-gray-50 border-gray-200"}`}>
                                                    <input
                                                        type="color"
                                                        value={newTagColor}
                                                        onChange={e => setNewTagColor(e.target.value)}
                                                        className="shrink-0 w-7 h-7 rounded-md cursor-pointer border-0 p-0 bg-transparent"
                                                        title="Alege culoare"
                                                    />
                                                    <input
                                                        autoFocus
                                                        value={newTagName}
                                                        onChange={e => setNewTagName(e.target.value)}
                                                        onKeyDown={e => { if (e.key === "Enter") handleCreateTag(); if (e.key === "Escape") { setNewTagOpen(false); setNewTagName(""); } }}
                                                        placeholder="Nume tag..."
                                                        className={`flex-1 min-w-0 h-7 text-sm bg-transparent border-none outline-none ${dark ? "text-white placeholder:text-[#6b68a0]" : "text-gray-900 placeholder:text-gray-400"}`}
                                                    />
                                                    <button
                                                        onClick={handleCreateTag}
                                                        disabled={savingTag || !newTagName.trim()}
                                                        title="Salvează tag"
                                                        className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-white transition-opacity hover:opacity-80 disabled:opacity-40 cursor-pointer"
                                                        style={{ background: newTagColor }}
                                                    >
                                                        {savingTag ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
                                                    </button>
                                                    <button
                                                        onClick={() => { setNewTagOpen(false); setNewTagName(""); setNewTagColor("#524E91"); }}
                                                        title="Anulează"
                                                        className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${dark ? "text-[#6b68a0] hover:text-white hover:bg-[#3a3768]" : "text-gray-400 hover:text-gray-600 hover:bg-gray-200"}`}
                                                    >
                                                        <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setNewTagOpen(true)}
                                                    className={`flex items-center justify-center gap-1.5 w-full text-xs font-medium h-8 rounded-lg border border-dashed transition-all cursor-pointer ${dark ? "border-[#3a3768] text-[#6b68a0] hover:border-[#524E91] hover:text-[#9b98c8]" : "border-gray-300 text-gray-400 hover:border-[#524E91] hover:text-[#524E91]"}`}
                                                >
                                                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                                                    Tag nou
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </section>
                            </aside>
                        </div>
                    </div>
                </main>
            </div>

            <Dialog open={editOpen} onOpenChange={open => !open && closeEditTask()}>
                <DialogContent className={`sm:max-w-md ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}`}>
                    <DialogHeader>
                        <DialogTitle className={dark ? "text-white" : "text-gray-900"}>Editează task</DialogTitle>
                        <DialogDescription className={dark ? "text-[#9b98c8]" : "text-gray-400"}>Actualizează detaliile taskului și salvează.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Titlu</Label>
                            <Input autoFocus placeholder="Titlu task" value={editForm.title}
                                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                onKeyDown={e => e.key === "Enter" && handleEditSave()} className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Descriere</Label>
                            <Input placeholder="Descriere (opțional)" value={editForm.description}
                                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Prioritate</Label>
                            <PrioritySelect value={editForm.priority} onChange={priority => setEditForm(f => ({ ...f, priority }))} dark={dark} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Termen limită</Label>
                            <Popover open={editCalendarOpen} onOpenChange={setEditCalendarOpen}>
                                <PopoverTrigger className={`inline-flex items-center w-full h-9 rounded-lg border px-3 text-sm font-normal text-left cursor-pointer ${dark ? "bg-[#2d2b52] border-[#3a3768] text-white hover:bg-[#3a3768]" : "bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100"} ${!editForm.dueDate ? (dark ? "text-[#6b68a0]" : "text-gray-400") : ""}`}>
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" />
                                    <span>{editForm.dueDate ? format(new Date(editForm.dueDate), "d MMMM yyyy", { locale: ro }) : "Alege o dată"}</span>
                                </PopoverTrigger>
                                <PopoverContent className={`w-auto p-0 ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}`} align="start">
                                    <Calendar mode="single" selected={editForm.dueDate ? new Date(editForm.dueDate) : undefined}
                                        onSelect={day => { setEditForm(f => ({ ...f, dueDate: day ? format(day, "yyyy-MM-dd") : "" })); setEditCalendarOpen(false); }}
                                        initialFocus locale={ro} />
                                </PopoverContent>
                            </Popover>
                            {editForm.dueDate && (
                                <button type="button" onClick={() => setEditForm(f => ({ ...f, dueDate: "" }))}
                                    className={`text-xs underline ${dark ? "text-[#9b98c8] hover:text-white" : "text-gray-400 hover:text-gray-600"}`}>Șterge data</button>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeEditTask}
                            className={`h-9 text-sm ${dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#524E91]/20 hover:text-white" : "border-gray-200 text-gray-600"}`}>
                            Anulează
                        </Button>
                        <Button onClick={handleEditSave} disabled={editSaving || !editForm.title.trim()}
                            className="h-9 text-sm text-white font-semibold hover:opacity-90"
                            style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}>
                            {editSaving ? "Se salvează..." : "Salvează"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!duplicateEditTaskName} onOpenChange={open => !open && setDuplicateEditTaskName(null)}>
                <AlertDialogContent className={dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className={dark ? "text-white" : ""}>Task cu același nume</AlertDialogTitle>
                        <AlertDialogDescription>Există deja un task numit „{duplicateEditTaskName}" în acest proiect. Vrei să salvezi oricum?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDuplicateEditTaskName(null)} className={dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#2d2b52]" : ""}>Anulează</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { setDuplicateEditTaskName(null); doEditSave(); }} className="text-white hover:opacity-90" style={{ background: "#524E91" }}>Salvează oricum</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
