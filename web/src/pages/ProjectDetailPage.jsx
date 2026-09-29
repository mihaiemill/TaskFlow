import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { jwtDecode } from "jwt-decode";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useFavorites } from "../context/FavoritesContext.jsx";
import { useProjects } from "../context/ProjectsContext.jsx";
import { useSidebarState } from "../context/SidebarContext.jsx";
import api from "../api/axiosInstance.js";
import { Sidebar } from "../components/ui/Sidebar.jsx";
import { Topbar } from "../components/ui/Topbar.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import PrioritySelect from "../components/PrioritySelect.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import { Calendar } from "../components/ui/calendar.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover.jsx";
import { ScrollArea } from "../components/ui/scroll-area.jsx";
import { CalendarIcon } from "lucide-react";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
    SheetDescription, SheetFooter,
} from "../components/ui/sheet.jsx";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog.jsx";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from "../components/ui/dialog.jsx";
import { SearchInput, FilterDropdown, STATUS_COLOR, PRIORITY_COLOR } from "../components/admin/shared.jsx";
import {
    DndContext, DragOverlay, PointerSensor,
    useSensor, useSensors, closestCorners, useDroppable,
} from "@dnd-kit/core";
import {
    SortableContext, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderTasks, dropIndex } from "../lib/kanban.js";

const PRIORITY_MAP = {
    High:   { label: "High",   dot: "bg-red-500",   badge: { dark: "bg-red-500/10 text-red-400 border border-red-500/20",     light: "bg-red-50 text-red-600 border border-red-200" } },
    Medium: { label: "Medium", dot: "bg-amber-400", badge: { dark: "bg-amber-400/10 text-amber-400 border border-amber-400/20", light: "bg-amber-50 text-amber-600 border border-amber-200" } },
    Low:    { label: "Low",    dot: "bg-green-500", badge: { dark: "bg-green-500/10 text-green-400 border border-green-500/20", light: "bg-green-50 text-green-600 border border-green-200" } },
};

const STATUS_MAP = {
    Done:       { label: "Finalizat",  badge: { dark: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20", light: "bg-emerald-50 text-emerald-600 border border-emerald-200" } },
    InProgress: { label: "În progres", badge: { dark: "bg-blue-500/10 text-blue-400 border border-blue-500/20",         light: "bg-blue-50 text-blue-600 border border-blue-200" } },
    Todo:       { label: "De făcut",   badge: { dark: "bg-[#2d2b52] text-[#9b98c8] border border-[#3a3768]",            light: "bg-gray-100 text-gray-600 border border-gray-300" } },
};

const COLUMNS = [
    { id: "Todo",       label: "De făcut",   color: "bg-gray-400" },
    { id: "InProgress", label: "În progres", color: "bg-[#5AC4C2]" },
    { id: "Done",       label: "Finalizat",  color: "bg-emerald-400" },
];

const STATUS_FILTER_OPTIONS = [
    { value: "Todo",       label: "De făcut" },
    { value: "InProgress", label: "În progres" },
    { value: "Done",       label: "Finalizat" },
];
const PRIORITY_FILTER_OPTIONS = [
    { value: "Low",    label: "Low" },
    { value: "Medium", label: "Medium" },
    { value: "High",   label: "High" },
];

const STATUS_ENUM = { Todo: 0, InProgress: 1, Done: 2 };
const ASSIGNEES_PREVIEW = 3;
const isColumnId = id => COLUMNS.some(c => c.id === id);
const statusOf = (id, list) => list.find(t => t.id === id)?.status;

// canDelete: controlat de myPermission (≥3) · canModify (≥2): editare — favoritul e mereu vizibil, indiferent de permisiune
function TaskCard({ task, dark, onDelete, onEdit, onClick, isDragging, isAnyDragging, canDelete, canModify, projectName, isFavorite, toggleFavorite }) {
    const prio = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.Low;
    // fără drept de modificare (doar Vizualizare) cardul nu poate fi tras — serverul ar refuza oricum mutarea
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id, disabled: !canModify });
    const favorited = isFavorite("task", task.id);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const handleClick = () => {
        if (!isAnyDragging) onClick();
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={handleClick} className="mb-1.5 cursor-pointer select-none">
            <Card className={`transition-all duration-150 ${dark
                ? "border-[#3a3768] bg-[#2d2b52]/80 hover:bg-[#2d2b52]"
                : "border-gray-200 bg-white hover:bg-gray-50 shadow-sm hover:shadow-md"}`}>
                <CardContent className="p-2">
                    <div className="flex items-stretch gap-2">
                        <div className="flex-1 min-w-0 py-0.5">
                            <p className={`font-medium text-sm truncate ${dark ? "text-white" : "text-gray-900"}`}>{task.title}</p>
                            {task.description && (
                                <p className={`text-xs mt-0.5 truncate ${dark ? "text-[#9b98c8]" : "text-gray-400"}`}>{task.description}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${prio.dot}`} />
                                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${dark ? prio.badge.dark : prio.badge.light}`}>{prio.label}</span>
                                {task.dueDate && (
                                    <span className={`text-[11px] flex items-center gap-1 ${dark ? "text-[#9b98c8]" : "text-gray-400"}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                        {new Date(task.dueDate).toLocaleDateString("ro-RO")}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className={`w-px self-stretch shrink-0 ${dark ? "bg-[#3a3768]" : "bg-gray-100"}`} />
                        {/* Editează (Modificare ≥2) + Delete (Ștergere ≥3) + Favorite (mereu vizibil) — coloană dreapta, centrată vertical pe toată înălțimea cardului */}
                        <div className="flex flex-col items-center justify-center gap-0.5 shrink-0">
                            {canModify && (
                                <button
                                    onClick={e => { e.stopPropagation(); onEdit(task); }}
                                    title="Editează task"
                                    className={`p-1 rounded transition-colors hover:text-[#524E91] hover:bg-[#524E91]/10 cursor-pointer ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                    </svg>
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    onClick={e => { e.stopPropagation(); onDelete(task.id); }}
                                    title="Șterge task"
                                    className={`p-1 rounded transition-colors hover:text-red-400 hover:bg-red-500/10 cursor-pointer ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                    </svg>
                                </button>
                            )}
                            <button
                                onClick={e => { e.stopPropagation(); toggleFavorite({ type: "task", id: task.id, name: task.title, projectId: task.projectId, projectName: projectName ?? "" }); }}
                                title={favorited ? "Elimină din favorite" : "Adaugă la favorite"}
                                className={`p-1 rounded transition-colors hover:bg-amber-400/10 cursor-pointer
                                    ${favorited ? "text-amber-400" : dark ? "text-[#6b68a0] hover:text-amber-400" : "text-gray-400 hover:text-amber-500"}`}>
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
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function KanbanColumn({ col, tasks, dark, onDelete, onEdit, onTaskClick, activeId, canDelete, canModify, projectName, isFavorite, toggleFavorite }) {
    const colTasks = tasks.filter(t => t.status === col.id);
    const { setNodeRef } = useDroppable({ id: col.id });
    const isAnyDragging = !!activeId;

    return (
        <div className={`flex flex-col rounded-xl w-full md:flex-1 md:min-w-65 md:max-w-sm ${dark ? "bg-[#1e1c3a]/60 border border-[#3a3768]" : "bg-gray-50 border border-gray-200"}`}>
            <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${dark ? "border-[#3a3768]" : "border-gray-200"}`}>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.color}`} />
                <span className={`text-sm font-semibold flex-1 ${dark ? "text-white" : "text-gray-800"}`}>{col.label}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${dark ? "bg-[#2d2b52] text-[#9b98c8]" : "bg-gray-200 text-gray-500"}`}>{colTasks.length}</span>
            </div>
            <div ref={setNodeRef} className="flex-1 p-3 overflow-y-auto min-h-32">
                <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {colTasks.map(t => (
                        <TaskCard key={t.id} task={t} dark={dark} onDelete={onDelete} onEdit={onEdit} onClick={() => onTaskClick(t.id)}
                            isDragging={activeId === t.id} isAnyDragging={isAnyDragging} canDelete={canDelete} canModify={canModify}
                            projectName={projectName} isFavorite={isFavorite} toggleFavorite={toggleFavorite} />
                    ))}
                </SortableContext>
                {colTasks.length === 0 && (
                    <div className={`flex items-center justify-center h-24 rounded-lg border-2 border-dashed ${dark ? "border-[#3a3768] text-[#6b68a0]" : "border-gray-200 text-gray-300"}`}>
                        <p className="text-xs">Niciun task</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ProjectDetailPage() {
    const { id } = useParams();
    const [tasks, setTasks]       = useState([]);
    const [project, setProject]   = useState(null);
    const { projects, refreshProjects } = useProjects();
    const [assignees, setAssignees] = useState([]);
    const [search, setSearch]     = useState("");
    const [statusFilter, setStatusFilter]     = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");
    const [sheetOpen, setSheetOpen]     = useState(false);
    const [creating, setCreating]       = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [form, setForm] = useState({ title: "", description: "", priority: 1, dueDate: "" });
    const [deleteTaskId, setDeleteTaskId]       = useState(null);
    const [duplicateTaskName, setDuplicateTaskName] = useState(null);
    const [duplicateEditTaskName, setDuplicateEditTaskName] = useState(null);
    const [activeId, setActiveId] = useState(null);

    // Editare task — popup deschis din flashcard-ul din Kanban
    const [editTask, setEditTask]         = useState(null);
    const [editForm, setEditForm]         = useState({ title: "", description: "", priority: 1, dueDate: "" });
    const [editSaving, setEditSaving]     = useState(false);
    const [editCalendarOpen, setEditCalendarOpen] = useState(false);

    // Asignare (admin) — utilizatori/grupuri disponibile + asignările curente (brute, fără owner virtual)
    const [assignSheetOpen, setAssignSheetOpen] = useState(false);
    const [assignTab, setAssignTab]     = useState("users");
    const [assignSearch, setAssignSearch] = useState("");
    const [allUsers, setAllUsers]       = useState([]);
    const [allGroups, setAllGroups]     = useState([]);
    const [adminAssignments, setAdminAssignments] = useState([]);
    const [assignBusyKey, setAssignBusyKey] = useState(null);
    const [removeAssignTarget, setRemoveAssignTarget] = useState(null);

    const { dark } = useTheme();
    const { sidebarOpen } = useSidebarState();
    const navigate = useNavigate();
    const { isFavorite, toggleFavorite, removeFavorite, updateFavorite } = useFavorites();
    const { token } = useAuth();

    const isAdmin = useMemo(() => {
        if (!token) return false;
        try {
            const decoded = jwtDecode(token);
            const email = decoded?.email ?? decoded?.Email ?? "";
            return email === "admin@admin.com";
        } catch { return false; }
    }, [token]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const loadAssignees = () => {
        api.get(`/projects/${id}/assignments`).then(r => setAssignees(r.data)).catch(() => {});
    };

    useEffect(() => {
        if (!id || id === "undefined") return;
        api.get(`/projects/${id}`).then(r => setProject(r.data));
        api.get(`/projects/${id}/tasks`).then(r => {
            setTasks(r.data);
            const lastTaskId = sessionStorage.getItem(`taskflow:lastTask:${id}`);
            const lastTask = lastTaskId && r.data.find(t => t.id === lastTaskId);
            if (lastTask) setMobileCol(lastTask.status);
        });
        refreshProjects();
        loadAssignees();
    }, [id]);

    // Tine la zi numele proiectului si al taskurilor sale in favorite, oriunde ar fi fost redenumite
    useEffect(() => {
        if (project) updateFavorite("project", project.id, { name: project.name, color: project.color });
    }, [project, updateFavorite]);

    useEffect(() => {
        tasks.forEach(t => updateFavorite("task", t.id, {
            name: t.title,
            projectId: t.projectId,
            ...(project ? { projectName: project.name } : {}),
        }));
    }, [tasks, project, updateFavorite]);

    useEffect(() => {
        if (!id || id === "undefined" || !isAdmin) return;
        api.get("/admin/users").then(r => setAllUsers(r.data)).catch(() => {});
        api.get("/admin/groups").then(r => setAllGroups(r.data)).catch(() => {});
        api.get(`/admin/projects/${id}/assignments`).then(r => setAdminAssignments(r.data)).catch(() => {});
    }, [id, isAdmin]);

    const refreshAssignments = async () => {
        const [pub, adm] = await Promise.all([
            api.get(`/projects/${id}/assignments`),
            api.get(`/admin/projects/${id}/assignments`),
        ]);
        setAssignees(pub.data);
        setAdminAssignments(adm.data);
    };

    const assignUser = async (userId) => {
        setAssignBusyKey(`user-${userId}`);
        try {
            await api.post(`/admin/projects/${id}/assign`, { userId });
            await refreshAssignments();
        } finally { setAssignBusyKey(null); }
    };

    const assignGroup = async (groupId) => {
        setAssignBusyKey(`group-${groupId}`);
        try {
            await api.post(`/admin/projects/${id}/assign`, { groupId });
            await refreshAssignments();
        } finally { setAssignBusyKey(null); }
    };

    const handleRemoveAssignment = async () => {
        if (!removeAssignTarget) return;
        const assignmentId = removeAssignTarget.id;
        setRemoveAssignTarget(null);
        setAssignBusyKey(`remove-${assignmentId}`);
        try {
            await api.delete(`/admin/projects/${id}/assignments/${assignmentId}`);
            await refreshAssignments();
        } finally { setAssignBusyKey(null); }
    };

    // myPermission: 1=Vizualizare, 2=Modificare, 3=Ștergere
    // fallback 3 până se încarcă proiectul sau pentru owner fără câmp
    const myPerm    = project?.myPermission ?? 1;
    const canModify = myPerm >= 2; // poate adăuga task-uri
    const canDelete = myPerm >= 3; // poate șterge task-uri

    const resetForm = () => { setForm({ title: "", description: "", priority: 1, dueDate: "" }); setCalendarOpen(false); };

    const handleCreate = async () => {
        if (!form.title.trim()) return;
        const duplicate = tasks.find(t => t.title.trim().toLowerCase() === form.title.trim().toLowerCase());
        if (duplicate) { setDuplicateTaskName(form.title.trim()); return; }
        await doCreate();
    };

    const doCreate = async () => {
        setCreating(true);
        try {
            const payload = { ...form, projectId: id, dueDate: form.dueDate || null, status: STATUS_ENUM[mobileCol] };
            const { data } = await api.post("/tasks", payload);
            setTasks(t => [...t, data]);
            setSheetOpen(false);
            resetForm();
        } finally { setCreating(false); }
    };

    const openEditTask = (task) => {
        setEditTask(task);
        setEditForm({
            title: task.title,
            description: task.description || "",
            priority: task.priority === "High" ? 2 : task.priority === "Medium" ? 1 : 0,
            dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
        });
    };

    const closeEditTask = () => { setEditTask(null); setEditCalendarOpen(false); };

    const handleEditSave = async () => {
        if (!editTask || !editForm.title.trim()) return;
        const duplicate = tasks.find(t => t.id !== editTask.id && t.title.trim().toLowerCase() === editForm.title.trim().toLowerCase());
        if (duplicate) { setDuplicateEditTaskName(editForm.title.trim()); return; }
        await doEditSave();
    };

    const doEditSave = async () => {
        if (!editTask) return;
        setEditSaving(true);
        try {
            const payload = { ...editForm, dueDate: editForm.dueDate || null };
            const { data } = await api.put(`/tasks/${editTask.id}`, payload);
            setTasks(ts => ts.map(t => t.id === editTask.id ? { ...t, ...data } : t));
            closeEditTask();
        } finally { setEditSaving(false); }
    };

    const handleDeleteTask = async () => {
        if (!deleteTaskId) return;
        await api.delete(`/tasks/${deleteTaskId}`);
        removeFavorite('task', deleteTaskId);
        setTasks(t => t.filter(t => t.id !== deleteTaskId));
        setDeleteTaskId(null);
    };

    // Poziția taskului la începutul drag-ului. handleDragOver mută deja taskul în state
    // (live preview), deci la drop trebuie să comparăm cu originea, nu cu state-ul curent.
    const dragOrigin = useRef(null);

    const handleDragStart = ({ active }) => {
        setActiveId(active.id);
        const task = tasks.find(t => t.id === active.id);
        dragOrigin.current = task && {
            status: task.status,
            index: tasks.filter(t => t.status === task.status).findIndex(t => t.id === active.id),
            snapshot: tasks,
        };
    };

    // Live preview: când taskul e dus deasupra unei alte coloane, îl mutăm deja în state
    // ca să se vadă cum "sare" acolo; reordonarea în cadrul aceleiași coloane e animată
    // nativ de dnd-kit fără să atingem state-ul.
    const handleDragOver = ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const activeStatus = statusOf(active.id, tasks);
        const overStatus = isColumnId(over.id) ? over.id : statusOf(over.id, tasks);
        if (!activeStatus || !overStatus || activeStatus === overStatus) return;

        const overColTasks = tasks.filter(t => t.status === overStatus && t.id !== active.id);
        const overIndex = overColTasks.findIndex(t => t.id === over.id);
        const newIndex = overIndex === -1 ? overColTasks.length : overIndex;

        setTasks(prev => reorderTasks(prev, active.id, overStatus, newIndex));
    };

    const handleDragCancel = () => {
        setActiveId(null);
        if (dragOrigin.current) setTasks(dragOrigin.current.snapshot);
        dragOrigin.current = null;
    };

    const handleDragEnd = async ({ active, over }) => {
        setActiveId(null);
        const origin = dragOrigin.current;
        dragOrigin.current = null;
        if (!origin) return;

        const targetStatus = over && (isColumnId(over.id) ? over.id : statusOf(over.id, tasks));
        if (!targetStatus) { setTasks(origin.snapshot); return; }

        const newIndex = dropIndex(tasks, active.id, over.id, targetStatus);

        setTasks(prev => reorderTasks(prev, active.id, targetStatus, newIndex));
        if (targetStatus === origin.status && newIndex === origin.index) return;

        try {
            await api.patch(`/tasks/${active.id}/reorder`, { status: STATUS_ENUM[targetStatus], order: newIndex });
        } catch {
            setTasks(origin.snapshot);
        }
    };

    const [mobileCol, setMobileCol] = useState("Todo");

    // Asignați: primii ASSIGNEES_PREVIEW în toolbar, lista completă (useri + grupuri) într-un pop-up
    const [assigneesOpen, setAssigneesOpen] = useState(false);
    const assignedUsers  = assignees.filter(a => a.type === "user");
    const assignedGroups = assignees.filter(a => a.type !== "user");

    const renderAssigneeChip = (a, onRemoveClick) => (
        <span key={`${a.type}-${a.id}`} className={`inline-flex items-center gap-1.5 text-xs pl-2.5 pr-1 py-0.5 rounded-full border font-medium
            ${a.type === "user"
                ? dark ? "bg-sky-400/10 text-sky-400 border-sky-400/30" : "bg-sky-50 text-sky-600 border-sky-200"
                : dark ? "bg-violet-400/10 text-violet-400 border-violet-400/30" : "bg-violet-50 text-violet-600 border-violet-200"}
            ${a.isOwner || !isAdmin ? "pr-2.5" : ""}`}>
            {a.type === "user"
                ? <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            {a.name}
            {isAdmin && !a.isOwner && (
                <button
                    onClick={() => { onRemoveClick?.(); setRemoveAssignTarget({ id: a.id, name: a.name, type: a.type }); }}
                    title={`Elimină ${a.name} din proiect`}
                    disabled={assignBusyKey === `remove-${a.id}`}
                    className={`shrink-0 flex items-center justify-center w-4 h-4 rounded-full transition-colors cursor-pointer disabled:opacity-40
                        ${dark ? "hover:bg-rose-400/20 hover:text-rose-400" : "hover:bg-rose-100 hover:text-rose-500"}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            )}
        </span>
    );
    const handleTaskClick = (taskId) => {
        sessionStorage.setItem(`taskflow:lastTask:${id}`, taskId);
        navigate(`/tasks/${taskId}`);
    };
    const activeTask = tasks.find(t => t.id === activeId);
    const filteredTasks = tasks.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) &&
        (!statusFilter || t.status === statusFilter) &&
        (!priorityFilter || t.priority === priorityFilter));

    // Asignare — derivate pentru sheet-ul de admin
    const assignedUserIds  = new Set(adminAssignments.filter(a => a.userId).map(a => a.userId));
    const assignedGroupIds = new Set(adminAssignments.filter(a => a.groupId).map(a => a.groupId));
    const assignSearchLc = assignSearch.trim().toLowerCase();
    const availableUsers = allUsers.filter(u =>
        !assignedUserIds.has(u.id) &&
        (u.fullName.toLowerCase().includes(assignSearchLc) || u.email.toLowerCase().includes(assignSearchLc)));
    const availableGroups = allGroups.filter(g =>
        !assignedGroupIds.has(g.id) && g.name.toLowerCase().includes(assignSearchLc));
    const assignedUserRows  = adminAssignments.filter(a => a.type === "user");
    const assignedGroupRows = adminAssignments.filter(a => a.type === "group");

    const inputCls = `h-9 text-sm ${dark
        ? "bg-[#2d2b52] border-[#3a3768] text-white placeholder:text-[#6b68a0] focus:border-[#524E91]"
        : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#524E91]"}`;
    const labelCls = `text-xs font-medium ${dark ? "text-[#9b98c8]" : "text-gray-500"}`;

    return (
        <div className={`flex h-screen overflow-hidden ${dark ? "" : "bg-linear-to-br from-[#f0efff] via-white to-[#e8fafa]"}`}
             style={dark ? { background: "linear-gradient(135deg, #13112a 0%, #1e1c3a 60%, #0f2a2a 100%)" } : {}}>
            <Sidebar projects={projects} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Topbar
                    breadcrumbs={[
                        { label: "Proiecte", to: "/projects" },
                        { label: project?.name ?? "..." },
                    ]}
                />

                <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-24 md:pb-6 overflow-auto">
                    {/* Container comun: căutarea, asignații și tabla pornesc de la aceeași margine stângă.
                        Lățimea max = 3 coloane max-w-sm (24rem) + 2 gap-uri de 1rem, centrată pe ecrane mari. */}
                    <div className="xl:max-w-[74rem] xl:mx-auto">
                    {/* Toolbar: search + filtre, apoi asignații pe același rând (trec dedesubt dacă nu încap) */}
                    <div className="mb-4 flex items-center gap-x-4 gap-y-3 flex-wrap">
                    {/* mobil: căutarea pe tot rândul, dedesubt Status + Prioritate pe jumătăți egale */}
                    <div className="w-full sm:w-auto sm:flex-1 sm:max-w-xl flex items-center gap-2 flex-wrap">
                        <div className="basis-full sm:basis-auto flex-1 min-w-50">
                            <SearchInput value={search} onChange={setSearch} placeholder="Caută taskuri..." dark={dark} />
                        </div>
                        <FilterDropdown value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} placeholder="Status" dark={dark} colorMap={STATUS_COLOR} className="flex-1 sm:flex-none" />
                        <FilterDropdown value={priorityFilter} onChange={setPriorityFilter} options={PRIORITY_FILTER_OPTIONS} placeholder="Prioritate" dark={dark} colorMap={PRIORITY_COLOR} className="flex-1 sm:flex-none" />
                    </div>

                    {/* Asignați — mobil: un singur rând compact (rezumat care deschide pop-up-ul + Asignează) */}
                    {(assignees.length > 0 || isAdmin) && (
                        <div className="flex sm:hidden items-center gap-2 w-full">
                            {assignees.length > 0 && (
                                <button onClick={() => setAssigneesOpen(true)}
                                    title="Vezi toți utilizatorii și grupurile asignate"
                                    className={`flex-1 min-w-0 h-9 flex items-center gap-2 px-3 rounded-lg border text-xs transition-colors cursor-pointer
                                        ${dark ? "bg-[#2d2b52] border-[#3a3768] text-[#9b98c8]" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                    <span className={`font-semibold shrink-0 ${dark ? "text-white" : "text-gray-800"}`}>
                                        {assignees.length} {assignees.length === 1 ? "asignat" : "asignați"}
                                    </span>
                                    <span className="truncate">· {assignees.map(a => a.name).join(", ")}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                </button>
                            )}
                            {isAdmin && (
                                <button onClick={() => setAssignSheetOpen(true)}
                                    className={`${assignees.length > 0 ? "shrink-0" : "flex-1"} inline-flex items-center justify-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 cursor-pointer`}
                                    style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                    Asignează
                                </button>
                            )}
                        </div>
                    )}

                    {/* Asignați — de la sm: chip-uri pe rândul toolbar-ului */}
                    {(assignees.length > 0 || isAdmin) && (
                        <div className="hidden sm:flex items-center gap-2 flex-wrap">
                            {assignees.length > 0 && (
                                <span className={`text-xs font-medium shrink-0 ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>Asignați:</span>
                            )}
                            {assignees.slice(0, ASSIGNEES_PREVIEW).map(a => renderAssigneeChip(a))}
                            {assignees.length > ASSIGNEES_PREVIEW && (
                                <button onClick={() => setAssigneesOpen(true)}
                                    title="Vezi toți utilizatorii și grupurile asignate"
                                    className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer
                                        ${dark ? "bg-[#2d2b52] border-[#3a3768] text-[#9b98c8] hover:text-white hover:bg-[#3a3768]" : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"}`}>
                                    +{assignees.length - ASSIGNEES_PREVIEW} · Vizualizează tot
                                </button>
                            )}
                            {isAdmin && (
                                <button onClick={() => setAssignSheetOpen(true)}
                                    className="inline-flex items-center gap-1 h-6 pl-1.5 pr-2.5 rounded-full text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:opacity-90 hover:scale-105 cursor-pointer"
                                    style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                    Asignează
                                </button>
                            )}
                        </div>
                    )}
                    </div>

                    {/* Pop-up — toți asignații proiectului, pe secțiuni */}
                    <Dialog open={assigneesOpen} onOpenChange={setAssigneesOpen}>
                        <DialogContent className={`sm:max-w-md ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}`}>
                            <DialogHeader>
                                <DialogTitle className={dark ? "text-white" : "text-gray-900"}>Asignați</DialogTitle>
                                <DialogDescription className={`text-xs ${dark ? "text-[#9b98c8]" : "text-gray-400"}`}>
                                    Toți utilizatorii și grupurile cu acces la <span className="font-semibold" style={{ color: "#524E91" }}>{project?.name}</span>.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="max-h-[60vh] overflow-y-auto space-y-4 -mx-1 px-1">
                                {[
                                    { label: "Utilizatori", items: assignedUsers },
                                    { label: "Grupuri",     items: assignedGroups },
                                ].filter(s => s.items.length > 0).map(section => (
                                    <div key={section.label} className="space-y-2">
                                        <p className={`text-[10px] uppercase tracking-widest font-semibold ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>
                                            {section.label} <span className="tabular-nums">({section.items.length})</span>
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {/* la eliminare închidem pop-up-ul, ca dialogul de confirmare să nu stea peste el */}
                                            {section.items.map(a => renderAssigneeChip(a, () => setAssigneesOpen(false)))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Mobile column tabs */}
                    <div className={`flex md:hidden rounded-xl overflow-hidden border mb-4 ${dark ? "border-[#3a3768]" : "border-gray-200"}`}>
                        {COLUMNS.map(col => {
                            const count = filteredTasks.filter(t => t.status === col.id).length;
                            const isActive = mobileCol === col.id;
                            return (
                                <button key={col.id} onClick={() => setMobileCol(col.id)}
                                    className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors
                                        ${isActive
                                            ? "bg-[#524E91] text-white"
                                            : dark ? "bg-[#1e1c3a] text-[#9b98c8] hover:bg-[#2d2b52]" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${col.color}`} />
                                    {col.label}
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : dark ? "bg-[#2d2b52] text-[#9b98c8]" : "bg-gray-100 text-gray-500"}`}>{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
                        <div className="md:hidden">
                            {COLUMNS.filter(col => col.id === mobileCol).map(col => (
                                <KanbanColumn key={col.id} col={col} tasks={filteredTasks} dark={dark}
                                    onDelete={taskId => setDeleteTaskId(taskId)} onEdit={openEditTask} onTaskClick={handleTaskClick}
                                    activeId={activeId} canDelete={canDelete} canModify={canModify} projectName={project?.name}
                                    isFavorite={isFavorite} toggleFavorite={toggleFavorite} />
                            ))}
                        </div>
                        <div className="hidden md:flex gap-4 items-start pb-4 justify-start">
                            {COLUMNS.map(col => (
                                <KanbanColumn key={col.id} col={col} tasks={filteredTasks} dark={dark}
                                    onDelete={taskId => setDeleteTaskId(taskId)} onEdit={openEditTask} onTaskClick={handleTaskClick}
                                    activeId={activeId} canDelete={canDelete} canModify={canModify} projectName={project?.name}
                                    isFavorite={isFavorite} toggleFavorite={toggleFavorite} />
                            ))}
                        </div>
                        <DragOverlay>
                            {activeTask && (
                                <div className="rotate-1 scale-105 opacity-95">
                                    <Card className={`border ${dark ? "border-[#524E91]/50 bg-[#2d2b52] shadow-xl shadow-[#524E91]/20" : "border-[#524E91]/30 bg-white shadow-xl"}`}>
                                        <CardContent className="p-3">
                                            <p className={`font-medium text-sm ${dark ? "text-white" : "text-gray-900"}`}>{activeTask.title}</p>
                                            {activeTask.description && (
                                                <p className={`text-xs mt-0.5 truncate ${dark ? "text-[#9b98c8]" : "text-gray-400"}`}>{activeTask.description}</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </DragOverlay>
                    </DndContext>
                    </div>
                </main>
            </div>

            {/* FAB — task nou, vizibil doar pentru Modificare (≥2) și Ștergere (≥3) */}
            {canModify && (
                <button onClick={() => setSheetOpen(true)} title="Task nou"
                    className={`fixed bottom-6 right-6 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-all duration-150 hover:scale-105 cursor-pointer z-50 hover:opacity-90 ${sidebarOpen ? "max-md:hidden" : ""}`}
                    style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)", boxShadow: "0 4px 20px rgba(82,78,145,0.4)" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </button>
            )}

            {/* Sheet — creare task */}
            <Sheet open={sheetOpen} onOpenChange={open => { setSheetOpen(open); if (!open) resetForm(); }}>
                <SheetContent className={`p-0 flex flex-col gap-0 max-w-sm w-full ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200"}`}>
                    <SheetHeader className={`px-6 py-5 border-b ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                        <SheetTitle className={`text-base font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Task nou</SheetTitle>
                        <SheetDescription className={`text-xs ${dark ? "text-[#9b98c8]" : "text-gray-400"}`}>Completează detaliile și apasă Salvează.</SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col gap-4 px-6 py-5 flex-1 overflow-y-auto">
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Titlu</Label>
                            <Input autoFocus placeholder="Titlu task" value={form.title}
                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                onKeyDown={e => e.key === "Enter" && handleCreate()} className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Descriere</Label>
                            <Input placeholder="Descriere (opțional)" value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Prioritate</Label>
                            <PrioritySelect value={form.priority} onChange={priority => setForm(f => ({ ...f, priority }))} dark={dark} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={labelCls}>Termen limită</Label>
                            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                <PopoverTrigger className={`inline-flex items-center w-full h-9 rounded-lg border px-3 text-sm font-normal text-left cursor-pointer ${dark ? "bg-[#2d2b52] border-[#3a3768] text-white hover:bg-[#3a3768]" : "bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100"} ${!form.dueDate ? (dark ? "text-[#6b68a0]" : "text-gray-400") : ""}`}>
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" />
                                    <span>{form.dueDate ? format(new Date(form.dueDate), "d MMMM yyyy", { locale: ro }) : "Alege o dată"}</span>
                                </PopoverTrigger>
                                <PopoverContent className={`w-auto p-0 ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}`} align="start">
                                    <Calendar mode="single" selected={form.dueDate ? new Date(form.dueDate) : undefined}
                                        onSelect={day => { setForm(f => ({ ...f, dueDate: day ? format(day, "yyyy-MM-dd") : "" })); setCalendarOpen(false); }}
                                        initialFocus locale={ro} />
                                </PopoverContent>
                            </Popover>
                            {form.dueDate && (
                                <button type="button" onClick={() => setForm(f => ({ ...f, dueDate: "" }))}
                                    className={`text-xs underline ${dark ? "text-[#9b98c8] hover:text-white" : "text-gray-400 hover:text-gray-600"}`}>Șterge data</button>
                            )}
                        </div>
                    </div>
                    <SheetFooter className={`px-6 py-4 border-t ${dark ? "border-[#3a3768]" : "border-gray-100"} flex flex-row gap-2`}>
                        <Button variant="outline" onClick={() => { setSheetOpen(false); resetForm(); }}
                            className={`flex-1 h-9 text-sm ${dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#524E91]/20 hover:text-white" : "border-gray-200 text-gray-600"}`}>
                            Anulează
                        </Button>
                        <Button onClick={handleCreate} disabled={creating || !form.title.trim()}
                            className="flex-1 h-9 text-sm text-white font-semibold hover:opacity-90"
                            style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}>
                            {creating ? "Se salvează..." : "Salvează"}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Dialog — editare task (popup, deschis din flashcard) */}
            <Dialog open={!!editTask} onOpenChange={open => !open && closeEditTask()}>
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

            <AlertDialog open={!!deleteTaskId} onOpenChange={open => !open && setDeleteTaskId(null)}>
                <AlertDialogContent className={dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className={dark ? "text-white" : ""}>Ștergi taskul?</AlertDialogTitle>
                        <AlertDialogDescription>Această acțiune este ireversibilă. Taskul va fi șters definitiv.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className={dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#2d2b52]" : ""}>Anulează</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTask} className="bg-red-600 hover:bg-red-500 text-white">Șterge</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Sheet — asignare utilizatori/grupuri (admin) */}
            {isAdmin && (
                <Sheet open={assignSheetOpen} onOpenChange={open => { setAssignSheetOpen(open); if (!open) setAssignSearch(""); }}>
                    <SheetContent className={`p-0 flex flex-col gap-0 max-w-sm w-full ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200"}`}>
                        <SheetHeader className={`px-6 py-5 border-b ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                            <SheetTitle className={`text-base font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Asignează la proiect</SheetTitle>
                            <SheetDescription className={`text-xs ${dark ? "text-[#9b98c8]" : "text-gray-400"}`}>Acordă acces la „{project?.name}" unor utilizatori sau grupuri.</SheetDescription>
                        </SheetHeader>

                        <div className="flex flex-col gap-4 px-6 py-5 flex-1 overflow-y-auto">
                            {/* Toggle tabs */}
                            <div className={`flex rounded-lg overflow-hidden border shrink-0 ${dark ? "border-[#3a3768]" : "border-gray-200"}`}>
                                {[
                                    { id: "users", label: "Utilizatori", count: assignedUserRows.length },
                                    { id: "groups", label: "Grupuri", count: assignedGroupRows.length },
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setAssignTab(tab.id)}
                                        className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer
                                            ${assignTab === tab.id
                                                ? "text-white"
                                                : dark ? "bg-[#2d2b52] text-[#9b98c8] hover:bg-[#3a3768]" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                                        style={assignTab === tab.id ? { background: "linear-gradient(135deg, #524E91, #5AC4C2)" } : {}}>
                                        {tab.label}
                                        {tab.count > 0 && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${assignTab === tab.id ? "bg-white/20" : dark ? "bg-[#3a3768] text-[#9b98c8]" : "bg-gray-200 text-gray-500"}`}>{tab.count}</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Deja asignați (pe tab-ul curent) */}
                            {(assignTab === "users" ? assignedUserRows : assignedGroupRows).length > 0 && (
                                <div className="space-y-1.5">
                                    <Label className={labelCls}>Deja asignați</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(assignTab === "users" ? assignedUserRows : assignedGroupRows).map(a => (
                                            <div key={a.id}
                                                className={`flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs border
                                                    ${dark ? "bg-[#2d2b52] border-[#3a3768] text-[#9b98c8]" : "bg-gray-100 border-gray-200 text-gray-600"}`}>
                                                <span className="truncate max-w-40">{a.name}</span>
                                                <button
                                                    onClick={() => setRemoveAssignTarget({ id: a.id, name: a.name, type: a.type })}
                                                    disabled={assignBusyKey === `remove-${a.id}`}
                                                    title={`Elimină ${a.name}`}
                                                    className={`shrink-0 flex items-center justify-center w-4 h-4 rounded-full transition-colors cursor-pointer disabled:opacity-40
                                                        ${dark ? "hover:bg-rose-400/20 hover:text-rose-400" : "hover:bg-rose-100 hover:text-rose-500"}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Disponibili */}
                            <div className="space-y-1.5">
                                <Label className={labelCls}>Adaugă {assignTab === "users" ? "utilizator" : "grup"}</Label>
                                <SearchInput value={assignSearch} onChange={setAssignSearch}
                                    placeholder={assignTab === "users" ? "Caută utilizator..." : "Caută grup..."} dark={dark} />
                                <div className={`rounded-lg border overflow-hidden ${dark ? "border-[#3a3768]" : "border-gray-200"}`}>
                                    <ScrollArea className="h-64">
                                        {assignTab === "users" ? (
                                            availableUsers.length === 0 ? (
                                                <div className={`py-4 text-center text-xs ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>
                                                    {allUsers.length === 0 ? "Se încarcă..." : "Niciun utilizator disponibil."}
                                                </div>
                                            ) : availableUsers.map(u => (
                                                <button key={u.id} onClick={() => assignUser(u.id)}
                                                    disabled={assignBusyKey === `user-${u.id}`}
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer transition-colors border-b last:border-0 disabled:opacity-40
                                                        ${dark ? "border-[#3a3768] hover:bg-[#2d2b52]" : "border-gray-100 hover:bg-gray-50"}`}>
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <span className={`text-xs font-medium truncate leading-tight ${dark ? "text-white" : "text-gray-800"}`}>{u.fullName}</span>
                                                        <span className={`text-[11px] truncate leading-tight ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>{u.email}</span>
                                                    </div>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 shrink-0 ${dark ? "text-[#6b68a0]" : "text-gray-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                                    </svg>
                                                </button>
                                            ))
                                        ) : (
                                            availableGroups.length === 0 ? (
                                                <div className={`py-4 text-center text-xs ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>
                                                    {allGroups.length === 0 ? "Se încarcă..." : "Niciun grup disponibil."}
                                                </div>
                                            ) : availableGroups.map(g => (
                                                <button key={g.id} onClick={() => assignGroup(g.id)}
                                                    disabled={assignBusyKey === `group-${g.id}`}
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer transition-colors border-b last:border-0 disabled:opacity-40
                                                        ${dark ? "border-[#3a3768] hover:bg-[#2d2b52]" : "border-gray-100 hover:bg-gray-50"}`}>
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <span className={`text-xs font-medium truncate leading-tight ${dark ? "text-white" : "text-gray-800"}`}>{g.name}</span>
                                                        <span className={`text-[11px] truncate leading-tight ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>{g.users?.length ?? 0} utilizator{(g.users?.length ?? 0) !== 1 ? "i" : ""}</span>
                                                    </div>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 shrink-0 ${dark ? "text-[#6b68a0]" : "text-gray-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                                    </svg>
                                                </button>
                                            ))
                                        )}
                                    </ScrollArea>
                                </div>
                            </div>
                        </div>

                        <SheetFooter className={`px-6 py-4 border-t ${dark ? "border-[#3a3768]" : "border-gray-100"}`}>
                            <Button variant="outline" onClick={() => setAssignSheetOpen(false)}
                                className={`w-full h-9 text-sm ${dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#524E91]/20 hover:text-white" : "border-gray-200 text-gray-600"}`}>
                                Închide
                            </Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
            )}

            <AlertDialog open={!!removeAssignTarget} onOpenChange={open => !open && setRemoveAssignTarget(null)}>
                <AlertDialogContent className={dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className={dark ? "text-white" : ""}>Elimini asignarea?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {removeAssignTarget?.type === "group"
                                ? <>Grupul <span className="font-semibold">„{removeAssignTarget?.name}"</span> va pierde accesul la acest proiect.</>
                                : <><span className="font-semibold">„{removeAssignTarget?.name}"</span> va pierde accesul la acest proiect.</>}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className={dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#2d2b52]" : ""}>Anulează</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveAssignment} className="bg-red-600 hover:bg-red-500 text-white">Elimină</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!duplicateTaskName} onOpenChange={open => !open && setDuplicateTaskName(null)}>
                <AlertDialogContent className={dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className={dark ? "text-white" : ""}>Task cu același nume</AlertDialogTitle>
                        <AlertDialogDescription>Există deja un task numit „{duplicateTaskName}" în acest proiect. Vrei să îl adaugi oricum?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDuplicateTaskName(null)} className={dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#2d2b52]" : ""}>Anulează</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { setDuplicateTaskName(null); doCreate(); }} className="text-white hover:opacity-90" style={{ background: "#524E91" }}>Adaugă oricum</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
