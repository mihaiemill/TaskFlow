import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiFetch } from "./admin/shared.jsx";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "./ui/dialog.jsx";

const EMPTY = { current: "", next: "", confirm: "" };

export function ChangePasswordDialog({ open, onOpenChange }) {
    const { dark } = useTheme();
    const { token } = useAuth();
    const [hasPassword, setHasPassword] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!open || !token) return;
        setForm(EMPTY); setError(""); setSuccess(false); setHasPassword(null);
        apiFetch("/api/auth/me", token)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(d => setHasPassword(d.hasPassword))
            .catch(() => setError("Nu s-au putut încărca datele contului."));
    }, [open, token]);

    const update = key => e => { setForm(f => ({ ...f, [key]: e.target.value })); setError(""); };

    async function handleSubmit() {
        if (hasPassword && !form.current) { setError("Introdu parola curentă."); return; }
        if (form.next.length < 6) { setError("Parola nouă trebuie să aibă cel puțin 6 caractere."); return; }
        if (form.next !== form.confirm) { setError("Parolele nu coincid."); return; }

        setSaving(true); setError("");
        try {
            const r = await apiFetch("/api/auth/change-password", token, {
                method: "POST",
                body: JSON.stringify({ currentPassword: hasPassword ? form.current : null, newPassword: form.next }),
            });
            if (!r.ok) {
                const e = await r.json().catch(() => ({}));
                setError(e.error ?? "Eroare la salvare.");
                return;
            }
            setSuccess(true);
            setTimeout(() => onOpenChange(false), 1200);
        } catch { setError("Eroare de rețea."); }
        finally { setSaving(false); }
    }

    const inputCls = `w-full h-9 px-3 rounded-lg border text-sm outline-none transition-colors
        ${dark ? "bg-[#2d2b52] border-[#3a3768] text-white placeholder:text-[#6b68a0] focus:border-[#524E91]"
               : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#524E91]"}`;
    const labelCls = `text-xs font-medium ${dark ? "text-[#9b98c8]" : "text-gray-500"}`;
    const onEnter = e => e.key === "Enter" && handleSubmit();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}>
                <DialogHeader>
                    <DialogTitle className={dark ? "text-white" : ""}>
                        {hasPassword === false ? "Setează o parolă" : "Schimbă parola"}
                    </DialogTitle>
                    <DialogDescription>
                        {hasPassword === false
                            ? "Contul tău folosește autentificarea Google. Poți seta o parolă ca să te poți conecta și cu email."
                            : "Introdu parola curentă și alege una nouă."}
                    </DialogDescription>
                </DialogHeader>

                {hasPassword === null && !error ? (
                    <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 rounded-full border-2 border-[#524E91] border-t-transparent animate-spin" />
                    </div>
                ) : success ? (
                    <p className="text-sm text-emerald-500 py-2">Parola a fost actualizată cu succes.</p>
                ) : (
                    <div className="space-y-3">
                        {hasPassword && (
                            <div className="space-y-1.5">
                                <label className={labelCls}>Parola curentă</label>
                                <input autoFocus type="password" autoComplete="current-password"
                                    value={form.current} onChange={update("current")} onKeyDown={onEnter} className={inputCls} />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className={labelCls}>Parola nouă</label>
                            <input autoFocus={!hasPassword} type="password" autoComplete="new-password" placeholder="Minim 6 caractere"
                                value={form.next} onChange={update("next")} onKeyDown={onEnter} className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Confirmă parola nouă</label>
                            <input type="password" autoComplete="new-password"
                                value={form.confirm} onChange={update("confirm")} onKeyDown={onEnter} className={inputCls} />
                        </div>
                        {error && <p className="text-xs text-rose-400">{error}</p>}
                    </div>
                )}

                {!success && (
                    <DialogFooter>
                        <button type="button" onClick={() => onOpenChange(false)}
                            className={`h-9 px-4 rounded-lg text-sm border transition-colors cursor-pointer ${dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#524E91]/20 hover:text-white" : "border-gray-200 text-gray-600 hover:border-[#524E91] hover:text-[#524E91]"}`}>
                            Anulează
                        </button>
                        <button onClick={handleSubmit} disabled={saving || hasPassword === null}
                            className="h-9 px-4 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 cursor-pointer"
                            style={{ background: "linear-gradient(135deg,#524E91,#5AC4C2)" }}>
                            {saving ? "Se salvează..." : "Salvează parola"}
                        </button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
