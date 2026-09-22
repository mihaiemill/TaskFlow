import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axiosInstance.js";
import { useTheme } from "../context/ThemeContext.jsx";
import { useFavorites } from "../context/FavoritesContext.jsx";
import { Sidebar } from "../components/ui/Sidebar.jsx";
import { Topbar } from "../components/ui/Topbar.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";

const PRIORITY_MAP = {
    High:   { label: "High",   dot: "bg-red-500",   badge: { dark: "bg-red-500/10 text-red-400 border border-red-500/20",     light: "bg-red-50 text-red-600 border border-red-200" } },
    Medium: { label: "Medium", dot: "bg-amber-400", badge: { dark: "bg-amber-400/10 text-amber-400 border border-amber-400/20", light: "bg-amber-50 text-amber-600 border border-amber-200" } },
    Low:    { label: "Low",    dot: "bg-green-500", badge: { dark: "bg-green-500/10 text-green-400 border border-green-500/20", light: "bg-green-50 text-green-600 border border-green-200" } },
};

const STATUS_MAP = {
    Done:       { label: "Finalizat",  badge: { dark: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20", light: "bg-emerald-50 text-emerald-600 border border-emerald-200" } },
    InProgress: { label: "În progres", badge: { dark: "bg-[#5AC4C2]/10 text-[#5AC4C2] border border-[#5AC4C2]/20",      light: "bg-[#5AC4C2]/10 text-[#3a9b9a] border border-[#5AC4C2]/30" } },
    Todo:       { label: "De făcut",   badge: { dark: "bg-[#2d2b52] text-[#9b98c8] border border-[#3a3768]",            light: "bg-gray-100 text-gray-600 border border-gray-300" } },
};

export default function TaskDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [tags, setTags] = useState([]);
    const [projects, setProjects] = useState([]);
    const [comment, setComment] = useState("");
    const [sendingComment, setSendingComment] = useState(false);
    const { dark } = useTheme();
    const { removeFavorite } = useFavorites();

    // Tag inline create
    const [newTagOpen, setNewTagOpen] = useState(false);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#524E91");
    const [savingTag, setSavingTag] = useState(false);
    const [showAllTags, setShowAllTags] = useState(false);

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
        api.get("/projects").then(r => setProjects(r.data));
    }, [id]);

    const handleStatusChange = async (status) => {
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

    const handleAddComment = async () => {
        if (!comment.trim()) return;
        setSendingComment(true);
        try {
            const { data } = await api.post(`/tasks/${id}/comments`, { text: comment });
            setTask(t => ({ ...t, comments: [...t.comments, data] }));
            setComment("");
        } finally { setSendingComment(false); }
    };

    if (!task) return (
        <div className={`min-h-screen flex items-center justify-center ${dark ? "" : "bg-linear-to-br from-[#f0efff] via-white to-[#e8fafa]"}`}
             style={dark ? { background: "linear-gradient(135deg, #13112a 0%, #1e1c3a 60%, #0f2a2a 100%)" } : {}}>
            <p className={`text-sm ${dark ? "text-[#9b98c8]" : "text-gray-500"}`}>Se încarcă...</p>
        </div>
    );

    const availableTags = tags.filter(t => !task.tags.find(tt => tt.id === t.id));
    const visibleTags = showAllTags ? availableTags : availableTags.slice(0, 10);
    const prio = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.Low;
    const status = STATUS_MAP[task.status] ?? STATUS_MAP.Todo;
    const taskProject = projects.find(p => p.id === task.projectId);

    // ─── Permisiuni ───────────────────────────────────────────────────────────
    // myPermission: 1=Vizualizare, 2=Modificare, 3=Ștergere
    // fallback 1 — fără grup asignat = doar vizualizare
    const myPerm    = taskProject?.myPermission ?? 1;
    const canModify = myPerm >= 2;
    // ─────────────────────────────────────────────────────────────────────────

    const inputCls = `h-10 ${dark
        ? "bg-[#2d2b52] border-[#3a3768] text-white placeholder:text-[#6b68a0] focus:border-[#524E91]"
        : "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#524E91]"}`;
    const selectCls = `rounded-md px-3 text-sm focus:outline-none border ${dark
        ? "bg-[#2d2b52] border-[#3a3768] text-white focus:border-[#524E91]"
        : "bg-gray-50 border-gray-300 text-gray-900 focus:border-[#524E91]"}`;
    const cardCls = `backdrop-blur-sm ${dark ? "border-[#3a3768] bg-[#1e1c3a]/80" : "border-gray-200 bg-white shadow-sm"}`;

    return (
        <div className={`flex h-screen overflow-hidden ${dark ? "" : "bg-linear-to-br from-[#f0efff] via-white to-[#e8fafa]"}`}
             style={dark ? { background: "linear-gradient(135deg, #13112a 0%, #1e1c3a 60%, #0f2a2a 100%)" } : {}}
        >
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
                    <div className="max-w-2xl mx-auto flex flex-col gap-5">

                        {/* Buton back */}
                        <button
                            onClick={() => navigate(`/projects/${task.projectId}`)}
                            className={`flex items-center gap-1.5 text-sm w-fit transition-colors duration-150 ${dark ? "text-[#9b98c8] hover:text-white" : "text-[#524E91] hover:text-[#3d3a6e]"}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                            Înapoi la {taskProject?.name ?? "proiect"}
                        </button>

                        {/* Main task card */}
                        <Card className={cardCls}>
                            <CardHeader className="pb-3">
                                <CardTitle className={`text-lg font-semibold leading-snug ${dark ? "text-white" : "text-gray-900"}`}>{task.title}</CardTitle>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${dark ? status.badge.dark : status.badge.light}`}>{status.label}</span>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${dark ? prio.badge.dark : prio.badge.light}`}>{prio.label}</span>
                                    {task.dueDate && <span className={`text-xs ${dark ? "text-[#9b98c8]" : "text-gray-500"}`}>Termen: {new Date(task.dueDate).toLocaleDateString("ro-RO")}</span>}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {task.description ? (
                                    <p className={`text-sm leading-relaxed ${dark ? "text-[#9b98c8]" : "text-gray-600"}`}>{task.description}</p>
                                ) : (
                                    <p className={`text-sm italic ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>Nicio descriere adăugată.</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Status */}
                        <Card className={cardCls}>
                            <CardContent className="p-5">
                                <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>Status</p>
                                {canModify ? (
                                    <select value={task.status} onChange={e => handleStatusChange(e.target.value)} className={`h-10 ${selectCls}`}>
                                        <option value="Todo">De făcut</option>
                                        <option value="InProgress">În progres</option>
                                        <option value="Done">Finalizat</option>
                                    </select>
                                ) : (
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${dark ? status.badge.dark : status.badge.light}`}>
                                        {status.label}
                                    </span>
                                )}
                            </CardContent>
                        </Card>

                        {/* Taguri */}
                        <Card className={cardCls}>
                            <CardContent className="p-5">
                                <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>Tag</p>

                                {/* Taguri existente pe task */}
                                <div className="flex gap-2 flex-wrap mb-3">
                                    {task.tags.map(t => (
                                        canModify ? (
                                            <button key={t.id} onClick={() => handleRemoveTag(t.id)}
                                                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full text-white transition-opacity hover:opacity-70 cursor-pointer"
                                                style={{ background: t.color }}>
                                                {t.name}
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                        ) : (
                                            <span key={t.id}
                                                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full text-white"
                                                style={{ background: t.color }}>
                                                {t.name}
                                            </span>
                                        )
                                    ))}
                                    {task.tags.length === 0 && !newTagOpen && (
                                        <p className={`text-sm ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>Niciun tag adăugat.</p>
                                    )}
                                </div>

                                {/* Taguri disponibile + buton tag nou — doar cu permisiune */}
                                {canModify && !newTagOpen && availableTags.length > 0 && (
                                    <div className="flex gap-1.5 flex-wrap mb-3">
                                        {visibleTags.map(t => (
                                            <button key={t.id} onClick={() => handleAddTag(t.id)}
                                                className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-all hover:opacity-80 cursor-pointer ${dark ? "border-[#3a3768] text-[#9b98c8] hover:border-[#524E91]" : "border-gray-200 text-gray-600 hover:border-[#524E91]"}`}
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
                                )}

                                {/* Inline create new tag — doar cu permisiune */}
                                {canModify && (newTagOpen ? (
                                    <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${dark ? "bg-[#2d2b52] border-[#3a3768]" : "bg-gray-50 border-gray-200"}`}>
                                        <div className="relative shrink-0">
                                            <input
                                                type="color"
                                                value={newTagColor}
                                                onChange={e => setNewTagColor(e.target.value)}
                                                className="w-7 h-7 rounded-md cursor-pointer border-0 p-0 bg-transparent"
                                                title="Alege culoare"
                                            />
                                        </div>
                                        <input
                                            autoFocus
                                            value={newTagName}
                                            onChange={e => setNewTagName(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter") handleCreateTag(); if (e.key === "Escape") { setNewTagOpen(false); setNewTagName(""); } }}
                                            placeholder="Nume tag..."
                                            className={`flex-1 h-7 text-sm bg-transparent border-none outline-none ${dark ? "text-white placeholder:text-[#6b68a0]" : "text-gray-900 placeholder:text-gray-400"}`}
                                        />
                                        <button
                                            onClick={handleCreateTag}
                                            disabled={savingTag || !newTagName.trim()}
                                            title="Salvează tag"
                                            className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-white transition-opacity hover:opacity-80 disabled:opacity-40 cursor-pointer"
                                            style={{ background: newTagColor }}
                                        >
                                            {savingTag ? (
                                                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => { setNewTagOpen(false); setNewTagName(""); setNewTagColor("#524E91"); }}
                                            title="Anulează"
                                            className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${dark ? "text-[#6b68a0] hover:text-white hover:bg-[#3a3768]" : "text-gray-400 hover:text-gray-600 hover:bg-gray-200"}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setNewTagOpen(true)}
                                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-all cursor-pointer ${dark ? "border-[#3a3768] text-[#6b68a0] hover:border-[#524E91] hover:text-[#9b98c8]" : "border-gray-300 text-gray-400 hover:border-[#524E91] hover:text-[#524E91]"}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        Tag nou
                                    </button>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Comentarii */}
                        <Card className={cardCls}>
                            <CardContent className="p-5">
                                <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>Comentarii</p>
                                <div className="flex flex-col gap-3 mb-4">
                                    {task.comments.length === 0 && <p className={`text-sm ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>Niciun comentariu încă.</p>}
                                    {task.comments.map(c => (
                                        <div key={c.id} className={`rounded-lg p-3 ${dark ? "bg-[#2d2b52]" : "bg-gray-50"}`}>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className={`text-xs font-medium ${dark ? "text-[#9b98c8]" : "text-gray-600"}`}>{c.authorName}</span>
                                                <span className={`text-xs ${dark ? "text-[#3a3768]" : "text-gray-300"}`}>·</span>
                                                <span className={`text-xs ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>{new Date(c.createdAt).toLocaleString("ro-RO")}</span>
                                            </div>
                                            <p className={`text-sm ${dark ? "text-white" : "text-gray-900"}`}>{c.text}</p>
                                        </div>
                                    ))}
                                </div>
                                {/* Input comentariu — doar cu permisiune >= 2 */}
                                {canModify && (
                                    <div className="flex gap-2">
                                        <Input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddComment()} placeholder="Adaugă comentariu..." className={inputCls} />
                                        <Button onClick={handleAddComment} disabled={sendingComment || !comment.trim()} className="text-white font-semibold h-10 px-4 shrink-0 hover:opacity-90" style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}>
                                            Trimite
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                    </div>
                </main>
            </div>
        </div>
    );
}
