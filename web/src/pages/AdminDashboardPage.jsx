import { useState, useEffect, useMemo } from "react";
import { Topbar } from "../components/ui/Topbar.jsx";
import { Sidebar } from "../components/ui/Sidebar.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    STATUS_COLOR, PRIORITY_COLOR, STATUS_RO, STATUS_OPTIONS, PRIORITY_OPTIONS,
    ColorDot, Pill, SearchInput, FilterDropdown,
} from "../components/admin/shared.jsx";

// ── UI helpers locale ────────────────────────────────────────────────────────

function TaskProgress({ done, total, dark }) {
    if (!total) return <span className={`text-xs italic ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>fără task-uri</span>;
    const pct = Math.round((done / total) * 100);
    const isDone = pct === 100;
    return (
        <div className="flex flex-col gap-1.5 w-28">
            <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold tabular-nums ${dark ? "text-white" : "text-gray-800"}`}>{done}/{total}</span>
                <span className={`text-[10px] font-semibold tabular-nums ${isDone ? "text-emerald-400" : dark ? "text-[#6b68a0]" : "text-gray-400"}`}>{pct}%</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ring-1 ${dark ? "bg-[#2d2b52] ring-[#3a3768]" : "bg-gray-100 ring-gray-200"}`}>
                <div className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${Math.max(pct, done > 0 ? 6 : 0)}%`, background: isDone ? "#10b981" : "linear-gradient(90deg,#524E91,#5AC4C2)" }} />
            </div>
        </div>
    );
}

function AccessChips({ assignments, dark }) {
    if (!assignments || assignments.length === 0) {
        return <span className={`text-xs italic ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>doar owner</span>;
    }
    const visible = assignments.slice(0, 2);
    const rest = assignments.length - visible.length;
    return (
        <div className="flex items-center gap-1 flex-wrap max-w-50">
            {visible.map((a, idx) => (
                <span key={idx} title={a.name} className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full border truncate max-w-24
                    ${a.type === "user"
                        ? dark ? "bg-sky-400/10 text-sky-400 border-sky-400/30" : "bg-sky-50 text-sky-600 border-sky-200"
                        : dark ? "bg-violet-400/10 text-violet-400 border-violet-400/30" : "bg-violet-50 text-violet-600 border-violet-200"}`}>
                    {a.name}
                </span>
            ))}
            {rest > 0 && (
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${dark ? "bg-[#2d2b52] text-[#9b98c8]" : "bg-gray-100 text-gray-500"}`}>+{rest}</span>
            )}
        </div>
    );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
    const { dark } = useTheme();
    const { token } = useAuth();

    const [stats,          setStats]          = useState({ usersCount: null, projectsCount: null, tasksCount: null });
    const [statsLoading,   setStatsLoading]   = useState(true);
    const [active,         setActive]         = useState("users");
    const [listData,       setListData]       = useState([]);
    const [listLoading,    setListLoading]    = useState(false);
    const [search,         setSearch]         = useState("");
    const [statusFilter,   setStatusFilter]   = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");
    const [projects,       setProjects]       = useState([]);

    useEffect(() => {
        if (!token) return;
        fetch("/api/admin/stats", { headers: { Authorization:`Bearer ${token}` } })
            .then(r => r.ok ? r.json() : Promise.reject()).then(setStats).catch(console.error)
            .finally(() => setStatsLoading(false));
        // load users by default
        setListLoading(true);
        fetch("/api/admin/users", { headers: { Authorization:`Bearer ${token}` } })
            .then(r => r.ok ? r.json() : Promise.reject()).then(setListData).catch(console.error)
            .finally(() => setListLoading(false));
        // proiectele utilizatorului curent pentru sidebar
        fetch("/api/projects", { headers: { Authorization:`Bearer ${token}` } })
            .then(r => r.ok ? r.json() : Promise.reject()).then(setProjects).catch(console.error);
    }, [token]);

    function resetFilters() { setSearch(""); setStatusFilter(""); setPriorityFilter(""); }

    function handleCardClick(key) {
        if (active === key) { setActive(null); setListData([]); resetFilters(); return; }
        setActive(key); setListData([]); resetFilters(); setListLoading(true);
        fetch(`/api/admin/${key}`, { headers: { Authorization:`Bearer ${token}` } })
            .then(r => r.ok ? r.json() : Promise.reject()).then(setListData).catch(console.error)
            .finally(() => setListLoading(false));
    }

    const filteredData = useMemo(() => {
        let data = listData;
        const q = search.trim().toLowerCase();
        if (q) {
            if (active === "users")    data = data.filter(u => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
            if (active === "projects") data = data.filter(p => p.name.toLowerCase().includes(q) || p.ownerName.toLowerCase().includes(q) || p.ownerEmail.toLowerCase().includes(q));
            if (active === "tasks")    data = data.filter(t => t.title.toLowerCase().includes(q) || t.ownerName.toLowerCase().includes(q) || t.projectName.toLowerCase().includes(q));
        }
        if (active === "tasks") {
            if (statusFilter)    data = data.filter(t => t.status   === statusFilter);
            if (priorityFilter)  data = data.filter(t => t.priority === priorityFilter);
        }
        return data;
    }, [listData, search, statusFilter, priorityFilter, active]);

    const activeFilters = (statusFilter?1:0)+(priorityFilter?1:0)+(search.trim()?1:0);

    const cardBg = dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200";
    const th     = dark ? "text-[#9b98c8]" : "text-gray-500";
    const td     = dark ? "text-white border-[#3a3768]" : "text-gray-800 border-gray-100";
    const stripe = dark ? "hover:bg-[#524E91]/10" : "hover:bg-[#524E91]/5";

    function renderUsers() {
        return (
            <Table>
                <TableHeader><TableRow className="border-0">
                    <TableHead className={th}>#</TableHead>
                    <TableHead className={th}>Nume</TableHead>
                    <TableHead className={th}>Email</TableHead>
                    <TableHead className={th}>Inregistrat</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {filteredData.length===0
                        ? <TableRow><TableCell colSpan={4} className={`text-center py-8 text-sm ${th}`}>Niciun rezultat.</TableCell></TableRow>
                        : filteredData.map((u,i)=>(
                            <TableRow key={u.id} className={`border-b ${td} ${stripe} transition-colors`}>
                                <TableCell className={`${th} text-xs`}>{i+1}</TableCell>
                                <TableCell className="font-medium">{u.fullName}</TableCell>
                                <TableCell className={th}>{u.email}</TableCell>
                                <TableCell className={`${th} text-xs`}>{new Date(u.createdAt).toLocaleDateString("ro-RO")}</TableCell>
                            </TableRow>
                        ))}
                </TableBody>
            </Table>
        );
    }
    function renderProjects() {
        return (
            <Table>
                <TableHeader><TableRow className="border-0">
                    <TableHead className={th}>#</TableHead>
                    <TableHead className={th}>Proiect</TableHead>
                    <TableHead className={th}>Utilizator</TableHead>
                    <TableHead className={th}>Task-uri</TableHead>
                    <TableHead className={th}>Acces</TableHead>
                    <TableHead className={th}>Creat</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {filteredData.length===0
                        ? <TableRow><TableCell colSpan={6} className={`text-center py-8 text-sm ${th}`}>Niciun rezultat.</TableCell></TableRow>
                        : filteredData.map((p,i)=>(
                            <TableRow key={p.id} className={`border-b ${td} ${stripe} transition-colors align-top`}>
                                <TableCell className={`${th} text-xs`}>{i+1}</TableCell>
                                <TableCell>
                                    <span className="flex items-center gap-2"><ColorDot color={p.color}/>{p.name}</span>
                                    {p.description && <span className={`block text-xs mt-0.5 max-w-50 truncate ${th}`}>{p.description}</span>}
                                </TableCell>
                                <TableCell>
                                    <span className="font-medium">{p.ownerName}</span>
                                    <span className={`block text-xs ${th}`}>{p.ownerEmail}</span>
                                </TableCell>
                                <TableCell><TaskProgress done={p.doneTasks} total={p.totalTasks} dark={dark}/></TableCell>
                                <TableCell><AccessChips assignments={p.assignments} dark={dark}/></TableCell>
                                <TableCell className={`${th} text-xs whitespace-nowrap`}>{new Date(p.createdAt).toLocaleDateString("ro-RO")}</TableCell>
                            </TableRow>
                        ))}
                </TableBody>
            </Table>
        );
    }
    function renderTasks() {
        return (
            <Table>
                <TableHeader><TableRow className="border-0">
                    <TableHead className={th}>#</TableHead>
                    <TableHead className={th}>Utilizator</TableHead>
                    <TableHead className={th}>Proiect</TableHead>
                    <TableHead className={th}>Task</TableHead>
                    <TableHead className={th}>Status</TableHead>
                    <TableHead className={th}>Prioritate</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {filteredData.length===0
                        ? <TableRow><TableCell colSpan={6} className={`text-center py-8 text-sm ${th}`}>Niciun rezultat.</TableCell></TableRow>
                        : filteredData.map((t,i)=>(
                            <TableRow key={t.id} className={`border-b ${td} ${stripe} transition-colors`}>
                                <TableCell className={`${th} text-xs`}>{i+1}</TableCell>
                                <TableCell className="font-medium whitespace-nowrap">{t.ownerName}</TableCell>
                                <TableCell><span className="flex items-center gap-2 whitespace-nowrap"><ColorDot color={t.projectColor}/>{t.projectName}</span></TableCell>
                                <TableCell className="max-w-40 truncate">{t.title}</TableCell>
                                <TableCell><Pill label={STATUS_RO[t.status]??t.status} colorCls={STATUS_COLOR[t.status]??""}/></TableCell>
                                <TableCell><Pill label={t.priority} colorCls={PRIORITY_COLOR[t.priority]??""}/></TableCell>
                            </TableRow>
                        ))}
                </TableBody>
            </Table>
        );
    }

    const tableRenderers = { users:renderUsers, projects:renderProjects, tasks:renderTasks };
    const searchPH = { users:"Cauta dupa nume sau email...", projects:"Cauta dupa proiect sau utilizator...", tasks:"Cauta dupa task, proiect sau utilizator..." };

    const statCards = [
        { key:"users",    label:"Utilizatori", value:stats.usersCount,
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        { key:"projects", label:"Proiecte",    value:stats.projectsCount,
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> },
        { key:"tasks",    label:"Task-uri",    value:stats.tasksCount,
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> },
    ];

    return (
        <div className={`flex h-screen overflow-hidden ${dark ? "bg-[#16152e]" : "bg-gray-50"}`}>
            <Sidebar projects={projects} />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Topbar breadcrumbs={[{ label:"Dashboard" }]} />

                <main className={`flex-1 overflow-y-auto p-6 sm:p-8 ${dark ? "text-white" : "text-gray-900"}`}>
                    <style>{`
                        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap');
                        @keyframes msgIn {
                            0%   { opacity:0; transform: translateY(14px) scale(0.96); }
                            60%  { opacity:1; transform: translateY(-3px) scale(1.01); }
                            100% { opacity:1; transform: translateY(0)    scale(1); }
                        }
                        .msg-in { animation: msgIn 0.35s cubic-bezier(0.22,1,0.36,1) both; }
                    `}</style>

                    <div className="max-w-6xl mx-auto">

                        {/* header */}
                        <div className="mb-7 flex items-center gap-3">
                            <div className="w-1 h-9 rounded-full shrink-0" style={{background:"linear-gradient(180deg,#524E91,#5AC4C2)"}}/>
                            <div>
                                <h1 className={`text-2xl font-bold leading-tight ${dark?"text-white":"text-gray-900"}`} style={{fontFamily:"'Space Grotesk',sans-serif"}}>
                                    Dashboard
                                </h1>
                                <p className={`text-xs mt-1 ${dark?"text-[#6b68a0]":"text-gray-400"}`}>Statistici generale și listele de utilizatori, proiecte și task-uri</p>
                            </div>
                        </div>

                        {/* ── Rând carduri statistici ── */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                            {statCards.map(({ key, label, value, icon }) => {
                                const isActive = active === key;
                                return (
                                    <button key={key} onClick={() => handleCardClick(key)}
                                        className={`group flex items-center gap-4 rounded-2xl border p-5 text-left transition-all duration-200 cursor-pointer
                                            ${isActive
                                                ? "border-[#524E91] shadow-lg shadow-[#524E91]/15 " + (dark?"bg-[#524E91]/15":"bg-[#524E91]/5")
                                                : cardBg + " hover:border-[#524E91]/40 hover:shadow-md"}`}>
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200
                                            ${isActive
                                                ? "text-white"
                                                : dark ? "bg-[#2d2b52] text-[#9b98c8] group-hover:text-white" : "bg-[#524E91]/10 text-[#524E91]"}`}
                                            style={isActive ? { background: "linear-gradient(135deg,#524E91,#5AC4C2)" } : {}}>
                                            {icon}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-[10px] uppercase tracking-widest font-semibold mb-1 ${isActive?"text-[#524E91]":dark?"text-[#9b98c8]":"text-gray-400"}`}>{label}</p>
                                            <p className={`text-2xl font-bold leading-none ${dark?"text-white":"text-gray-900"}`} style={{fontFamily:"'Space Grotesk',sans-serif"}}>
                                                {statsLoading
                                                    ? <span className={`inline-block w-8 h-6 rounded animate-pulse ${dark?"bg-[#3a3768]":"bg-gray-200"}`}/>
                                                    : (value ?? "---")}
                                            </p>
                                        </div>
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isActive ? "rotate-90" : ""} ${isActive?"text-[#524E91]":dark?"text-[#6b68a0]":"text-gray-300"}`}
                                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── Panou detaliu, pe toata latimea ── */}
                        {active ? (
                            <div key={active} className={`msg-in rounded-2xl border ${cardBg}`} style={{overflow:"visible"}}>
                                <div className={`flex items-center justify-between px-6 py-4 border-b ${dark?"border-[#3a3768]":"border-gray-100"}`}>
                                    <h2 className={`text-sm font-semibold ${dark?"text-white":"text-gray-800"}`} style={{fontFamily:"'Space Grotesk',sans-serif"}}>
                                        {statCards.find(c=>c.key===active)?.label}
                                        {!listLoading && (
                                            <span className={`ml-2 text-xs font-normal ${dark?"text-[#9b98c8]":"text-gray-400"}`}>
                                                {filteredData.length !== listData.length ? `${filteredData.length} / ${listData.length}` : `(${listData.length})`}
                                            </span>
                                        )}
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        {activeFilters > 0 && (
                                            <button onClick={resetFilters}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all bg-[#524E91]/15 text-[#7b78c8] border border-[#524E91]/30 hover:bg-[#524E91]/30 hover:text-white">
                                                Reseteaza
                                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#524E91] text-white text-[10px] font-bold leading-none">{activeFilters}</span>
                                            </button>
                                        )}
                                        <button onClick={() => { setActive(null); setListData([]); resetFilters(); }}
                                            className={`p-1 rounded transition-colors ${dark?"text-[#6b68a0] hover:text-white":"text-gray-400 hover:text-gray-700"}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {!listLoading && listData.length > 0 && (
                                    <div className="px-6 pt-4 flex items-center gap-2 flex-wrap" style={{position:"relative",zIndex:10}}>
                                        <SearchInput value={search} onChange={setSearch} placeholder={searchPH[active]} dark={dark}/>
                                        {active === "tasks" && (
                                            <>
                                                <FilterDropdown value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="Status" dark={dark} colorMap={STATUS_COLOR}/>
                                                <FilterDropdown value={priorityFilter} onChange={setPriorityFilter} options={PRIORITY_OPTIONS} placeholder="Prioritate" dark={dark} colorMap={PRIORITY_COLOR}/>
                                            </>
                                        )}
                                    </div>
                                )}

                                {listLoading
                                    ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-[#524E91] border-t-transparent animate-spin"/></div>
                                    : <ScrollArea className="h-125 mt-3"><div className="px-3 pb-3">{tableRenderers[active]?.()}</div></ScrollArea>}
                            </div>
                        ) : (
                            <div className={`rounded-2xl border p-14 flex flex-col items-center justify-center text-center gap-2 ${cardBg}`}>
                                <p className={`text-sm ${dark?"text-[#9b98c8]":"text-gray-500"}`}>Selecteaza un card de mai sus pentru a vedea detaliile.</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
