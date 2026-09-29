import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext.jsx";
import { AvatarPicker, UserAvatar } from "./UserAvatar.jsx";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "./ui/dialog.jsx";

export function AvatarDialog({ open, onOpenChange, name, currentAvatar, description, onSave }) {
    const { dark } = useTheme();
    const [selected, setSelected] = useState(currentAvatar ?? null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return;
        setSelected(currentAvatar ?? null); setError("");
    }, [open, currentAvatar]);

    async function handleSave() {
        setSaving(true); setError("");
        try {
            const err = await onSave(selected);
            if (err) { setError(err); return; }
            onOpenChange(false);
        } catch { setError("Eroare de rețea."); }
        finally { setSaving(false); }
    }

    const unchanged = (selected ?? null) === (currentAvatar ?? null);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`sm:max-w-md ${dark ? "bg-[#1e1c3a] border-[#3a3768]" : ""}`}>
                <DialogHeader>
                    <DialogTitle className={dark ? "text-white" : ""}>Alege avatarul</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-3">
                    <UserAvatar avatar={selected} name={name} className="size-12 text-2xl" />
                    <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${dark ? "text-white" : "text-gray-900"}`}>{name}</p>
                        <p className={`text-xs ${dark ? "text-[#9b98c8]" : "text-gray-500"}`}>Previzualizare</p>
                    </div>
                </div>

                <div className="py-1">
                    <AvatarPicker value={selected} onChange={setSelected} name={name} dark={dark} allowNone />
                </div>
                {error && <p className="text-xs text-rose-400">{error}</p>}

                <DialogFooter>
                    <button type="button" onClick={() => onOpenChange(false)}
                        className={`h-9 px-4 rounded-lg text-sm border transition-colors cursor-pointer ${dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#524E91]/20 hover:text-white" : "border-gray-200 text-gray-600 hover:border-[#524E91] hover:text-[#524E91]"}`}>
                        Anulează
                    </button>
                    <button onClick={handleSave} disabled={saving || unchanged}
                        className="h-9 px-4 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 cursor-pointer"
                        style={{ background: "linear-gradient(135deg,#524E91,#5AC4C2)" }}>
                        {saving ? "Se salvează..." : "Salvează avatarul"}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
