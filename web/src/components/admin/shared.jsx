// ── constants & UI helpers comune pentru paginile de admin (Dashboard + Grupuri) ──
import { useState } from "react";

export const STATUS_COLOR = {
    Todo:       "bg-gray-400/20 text-gray-400 border border-gray-400/30",
    InProgress: "bg-amber-400/20 text-amber-400 border border-amber-400/30",
    Done:       "bg-emerald-400/20 text-emerald-400 border border-emerald-400/30",
};
export const PRIORITY_COLOR = {
    Low:    "bg-sky-400/20 text-sky-400 border border-sky-400/30",
    Medium: "bg-amber-400/20 text-amber-400 border border-amber-400/30",
    High:   "bg-rose-400/20 text-rose-400 border border-rose-400/30",
};
export const STATUS_RO = { Todo: "De facut", InProgress: "In progres", Done: "Finalizat" };

export const STATUS_OPTIONS   = [{ value:"Todo",label:"De facut"},{ value:"InProgress",label:"In progres"},{ value:"Done",label:"Finalizat"}];
export const PRIORITY_OPTIONS = [{ value:"Low",label:"Low"},{ value:"Medium",label:"Medium"},{ value:"High",label:"High"}];

export const PERM_OPTIONS = [
    { level: 1, label: "Viz.",   title: "Vizualizare — poate doar vedea conținutul proiectului/task-ului",        activeCls: "bg-sky-500 text-white" },
    { level: 2, label: "Modif.", title: "Modificare — poate adăuga și edita (include Vizualizare, fără Ștergere)", activeCls: "bg-[#524E91] text-white" },
    { level: 3, label: "Sterg.", title: "Ștergere — drepturi complete (include Modificare și Vizualizare)",        activeCls: "bg-rose-500 text-white" },
];

export function apiFetch(path, token, opts = {}) {
    return fetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}

export function ColorDot({ color }) {
    return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color || "#524E91" }} />;
}

export function Pill({ label, colorCls }) {
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorCls}`}>{label}</span>;
}

export function SearchInput({ value, onChange, placeholder, dark }) {
    return (
        <div className={`flex items-center gap-2 px-3 h-9 rounded-lg border flex-1 min-w-0
            ${dark ? "bg-[#2d2b52] border-[#3a3768] focus-within:border-[#524E91]"
                   : "bg-gray-50 border-gray-200 focus-within:border-[#524E91]"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 shrink-0 ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className={`flex-1 bg-transparent text-xs outline-none ${dark ? "text-white placeholder:text-[#6b68a0]" : "text-gray-900 placeholder:text-gray-400"}`} />
            {value && (
                <button onClick={() => onChange("")} className={`shrink-0 ${dark ? "text-[#6b68a0] hover:text-white" : "text-gray-400 hover:text-gray-600"}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            )}
        </div>
    );
}

export function FilterDropdown({ value, onChange, options, placeholder, dark, colorMap, className = "" }) {
    const [open, setOpen] = useState(false);
    const selected = options.find(o => o.value === value);
    return (
        <div className={`relative shrink-0 ${className}`}>
            <button onClick={() => setOpen(p => !p)}
                className={`h-9 w-full flex items-center justify-between gap-2 pl-3 pr-2.5 rounded-lg border text-xs transition-colors whitespace-nowrap
                    ${value ? "border-[#524E91] " + (dark ? "bg-[#524E91]/15 text-white" : "bg-[#524E91]/8 text-[#524E91]")
                            : dark ? "bg-[#2d2b52] border-[#3a3768] text-[#9b98c8] hover:border-[#524E91]/60"
                                   : "bg-gray-50 border-gray-200 text-gray-500 hover:border-[#524E91]/40"}`}>
                {selected && colorMap
                    ? <span className={`inline-flex items-center px-1.5 py-px rounded-full text-xs ${colorMap[selected.value] ?? ""}`}>{selected.label}</span>
                    : <span>{selected ? selected.label : placeholder}</span>}
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className={`absolute right-0 top-10 z-50 min-w-37.5 rounded-xl border shadow-xl overflow-hidden
                        ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : "bg-white border-gray-200"}`}>
                        <button onClick={() => { onChange(""); setOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-xs transition-colors
                                ${dark ? "text-[#6b68a0] hover:bg-[#2d2b52] hover:text-[#9b98c8]" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"}`}>
                            {placeholder}
                        </button>
                        <div className={`h-px mx-3 ${dark ? "bg-[#3a3768]" : "bg-gray-100"}`} />
                        {options.map(o => (
                            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-colors
                                    ${value === o.value ? dark ? "bg-[#524E91]/20" : "bg-[#524E91]/8"
                                                        : dark ? "hover:bg-[#2d2b52]" : "hover:bg-gray-50"}`}>
                                {colorMap
                                    ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[o.value] ?? ""}`}>{o.label}</span>
                                    : <span className={`text-xs ${dark ? "text-white" : "text-gray-800"}`}>{o.label}</span>}
                                {value === o.value && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 ml-auto shrink-0" style={{ color:"#524E91" }}
                                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export function PermSelector({ level = 1, onChange, dark }) {
    return (
        <div className={`flex rounded-md overflow-hidden border shrink-0 ${dark ? "border-[#3a3768]" : "border-gray-200"}`}>
            {PERM_OPTIONS.map(({ level: lvl, label, title, activeCls }) => (
                <button key={lvl} title={title} onClick={() => onChange(lvl)}
                    className={`px-2 py-0.5 text-[9px] font-semibold transition-colors whitespace-nowrap border-r last:border-r-0
                        ${dark ? "border-[#3a3768]" : "border-gray-200"}
                        ${level === lvl
                            ? activeCls
                            : dark
                                ? "bg-[#2d2b52] text-[#6b68a0] hover:text-[#9b98c8]"
                                : "bg-gray-50 text-gray-400 hover:text-gray-600"}`}>
                    {label}
                </button>
            ))}
        </div>
    );
}
