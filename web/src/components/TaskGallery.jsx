import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Images, Trash2, Maximize2, Loader2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import api from "../api/axiosInstance.js";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog.jsx";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog.jsx";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 20;

// Pager segmentat ‹ 1/3 › — același stil ca navigarea din pagina de grupuri
function Pager({ index, count, onPrev, onNext, dark }) {
    const btn = `flex items-center justify-center w-8 h-8 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer
        ${dark ? "text-[#9b98c8] hover:bg-[#2d2b52] disabled:hover:bg-transparent" : "text-gray-500 hover:bg-gray-50 disabled:hover:bg-transparent"}`;
    return (
        <div className={`flex items-center rounded-lg border overflow-hidden shrink-0 ${dark ? "border-[#3a3768]" : "border-gray-200"}`}>
            <button type="button" onClick={onPrev} disabled={index === 0} title="Imaginea anterioară" className={btn}>
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
            <span className={`px-2 text-[11px] font-medium tabular-nums border-x ${dark ? "border-[#3a3768] text-[#9b98c8]" : "border-gray-200 text-gray-500"}`}>
                {index + 1}/{count}
            </span>
            <button type="button" onClick={onNext} disabled={index >= count - 1} title="Imaginea următoare" className={btn}>
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
        </div>
    );
}

// Imaginile cer token JWT, deci le luăm ca blob prin axios și le ținem ca object URL-uri
function useImageUrls(taskId, images) {
    const [urls, setUrls] = useState({});
    const cacheRef = useRef(new Map());
    const pendingRef = useRef(new Set());
    const wantedRef = useRef(new Set());
    const imageIds = images.map(i => i.id).join(",");

    useEffect(() => {
        const wanted = new Set(imageIds ? imageIds.split(",") : []);
        wantedRef.current = wanted;

        for (const [id, url] of cacheRef.current) {
            if (!wanted.has(id)) { URL.revokeObjectURL(url); cacheRef.current.delete(id); }
        }
        setUrls(Object.fromEntries(cacheRef.current));

        wanted.forEach(id => {
            if (cacheRef.current.has(id) || pendingRef.current.has(id)) return;
            pendingRef.current.add(id);
            api.get(`/tasks/${taskId}/images/${id}`, { responseType: "blob" })
                .then(r => {
                    const url = URL.createObjectURL(r.data);
                    if (!wantedRef.current.has(id)) { URL.revokeObjectURL(url); return; }
                    cacheRef.current.set(id, url);
                    setUrls(Object.fromEntries(cacheRef.current));
                })
                .catch(() => {})
                .finally(() => pendingRef.current.delete(id));
        });
    }, [taskId, imageIds]);

    useEffect(() => () => {
        cacheRef.current.forEach(url => URL.revokeObjectURL(url));
        cacheRef.current.clear();
    }, []);

    return urls;
}

export function TaskGallery({ task, onImagesChange, canModify, dark, cardCls }) {
    const images = task.images ?? [];
    const urls = useImageUrls(task.id, images);
    const inputRef = useRef(null);
    const touchStartX = useRef(null);

    const [index, setIndex] = useState(0);
    const [uploadProgress, setUploadProgress] = useState(null); // { done, total }
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState("");
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const count = images.length;
    const current = images[Math.min(index, count - 1)];
    const currentIndex = Math.min(index, Math.max(count - 1, 0));
    const uploading = uploadProgress !== null;

    const prev = useCallback(() => setIndex(i => Math.max(0, Math.min(i, count - 1) - 1)), [count]);
    const next = useCallback(() => setIndex(i => Math.min(count - 1, i + 1)), [count]);

    // Săgețile de la tastatură în lightbox
    useEffect(() => {
        if (!lightboxOpen) return;
        const onKey = e => {
            if (e.key === "ArrowLeft") prev();
            if (e.key === "ArrowRight") next();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [lightboxOpen, prev, next]);

    const uploadFiles = async (fileList) => {
        const files = [...(fileList ?? [])];
        if (files.length === 0) return;
        setError("");

        const valid = files.filter(f => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_SIZE);
        const skipped = files.length - valid.length;
        const room = MAX_IMAGES - count;
        const toUpload = valid.slice(0, room);

        if (room <= 0) { setError(`Un task poate avea maxim ${MAX_IMAGES} imagini.`); return; }

        let added = [...images];
        let failed = 0;
        setUploadProgress({ done: 0, total: toUpload.length });
        for (const [i, file] of toUpload.entries()) {
            const form = new FormData();
            form.append("file", file);
            try {
                const { data } = await api.post(`/tasks/${task.id}/images`, form);
                added = [...added, data];
                onImagesChange(added);
            } catch { failed++; }
            setUploadProgress({ done: i + 1, total: toUpload.length });
        }
        setUploadProgress(null);
        if (inputRef.current) inputRef.current.value = "";
        if (added.length > count) setIndex(count); // sari la prima imagine nouă

        const problems = [];
        if (skipped) problems.push(`${skipped} fișier${skipped > 1 ? "e ignorate" : " ignorat"} (format sau mărime > 5 MB)`);
        if (valid.length > room) problems.push(`limita de ${MAX_IMAGES} imagini a fost atinsă`);
        if (failed) problems.push(`${failed} încărcăr${failed > 1 ? "i eșuate" : "e eșuată"}`);
        if (problems.length) setError(problems.join(" · "));
    };

    const confirmDelete = async () => {
        const target = deleteTarget;
        setDeleteTarget(null);
        if (!target) return;
        try {
            await api.delete(`/tasks/${task.id}/images/${target.id}`);
            const remaining = images.filter(i => i.id !== target.id);
            onImagesChange(remaining);
            setIndex(i => Math.min(i, Math.max(remaining.length - 1, 0)));
            if (remaining.length === 0) setLightboxOpen(false);
        } catch {
            setError("Ștergerea a eșuat.");
        }
    };

    const dropHandlers = canModify ? {
        onDragOver: e => { e.preventDefault(); setDragOver(true); },
        onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); },
        onDrop: e => { e.preventDefault(); setDragOver(false); if (!uploading) uploadFiles(e.dataTransfer.files); },
    } : {};

    const swipeHandlers = {
        onTouchStart: e => { touchStartX.current = e.touches[0].clientX; },
        onTouchEnd: e => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (dx > 40) prev();
            if (dx < -40) next();
            touchStartX.current = null;
        },
    };

    const muted = dark ? "text-[#6b68a0]" : "text-gray-400";
    const overlayBtn = "w-8 h-8 rounded-full flex items-center justify-center bg-black/45 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-105 cursor-pointer disabled:opacity-0 disabled:pointer-events-none";

    return (
        <div className={`relative rounded-2xl border p-5 ${cardCls}`} {...dropHandlers}>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={e => uploadFiles(e.target.files)}
            />

            {/* Header */}
            <div className="flex items-center gap-2.5 mb-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${dark ? "bg-[#2d2b52] text-[#9b98c8]" : "bg-[#524E91]/10 text-[#524E91]"}`}>
                    <Images className="w-4 h-4" />
                </div>
                <h2 className={`text-sm font-semibold ${dark ? "text-white" : "text-gray-900"}`}>Imagini</h2>
                {count > 0 && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dark ? "bg-[#2d2b52] text-[#9b98c8]" : "bg-gray-100 text-gray-500"}`}>{count}</span>
                )}
                <div className="ml-auto flex items-center gap-2">
                    {count > 1 && <Pager index={currentIndex} count={count} onPrev={prev} onNext={next} dark={dark} />}
                    {canModify && count > 0 && (
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            disabled={uploading || count >= MAX_IMAGES}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: "linear-gradient(135deg,#524E91,#5AC4C2)" }}
                        >
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />}
                            <span className="hidden sm:inline">{uploading ? `${uploadProgress.done}/${uploadProgress.total}` : "Adaugă"}</span>
                        </button>
                    )}
                </div>
            </div>

            {count === 0 && !canModify ? (
                /* Empty state — doar vizualizare */
                <div className="flex flex-col items-center justify-center text-center gap-1.5 py-6">
                    <Images className={`w-6 h-6 ${muted}`} />
                    <p className={`text-sm ${muted}`}>Nicio imagine adăugată.</p>
                </div>
            ) : count === 0 ? (
                /* Empty state — dropzone */
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className={`w-full flex flex-col items-center justify-center gap-2 py-7 rounded-xl border-2 border-dashed transition-all cursor-pointer disabled:cursor-wait ${
                        dragOver
                            ? "border-[#5AC4C2] bg-[#5AC4C2]/10"
                            : dark ? "border-[#3a3768] hover:border-[#524E91] hover:bg-[#2d2b52]/50" : "border-gray-200 hover:border-[#524E91] hover:bg-[#524E91]/3"
                    }`}
                >
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#524E91]/20" style={{ background: "linear-gradient(135deg,#524E91,#5AC4C2)" }}>
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                    </span>
                    <span className={`text-sm font-medium ${dark ? "text-white" : "text-gray-900"}`}>
                        {uploading ? `Se încarcă ${uploadProgress.done}/${uploadProgress.total}...` : "Adaugă imagini"}
                    </span>
                    <span className={`text-xs ${muted}`}>Click sau trage fișierele aici · PNG, JPG, GIF, WEBP · max 5 MB</span>
                </button>
            ) : (
                <>
                    {/* Stage */}
                    <div
                        className={`group relative h-52 sm:h-64 rounded-xl overflow-hidden select-none ${dark ? "bg-[#13112a]" : "bg-gray-100"}`}
                        {...swipeHandlers}
                    >
                        {urls[current.id] ? (
                            <img
                                key={current.id}
                                src={urls[current.id]}
                                alt={`${task.title} — imaginea ${currentIndex + 1}`}
                                onClick={() => setLightboxOpen(true)}
                                className="absolute inset-0 w-full h-full object-contain cursor-zoom-in animate-in fade-in-0 duration-200"
                                draggable={false}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className={`w-6 h-6 animate-spin ${muted}`} />
                            </div>
                        )}

                        {currentIndex > 0 && (
                            <button type="button" onClick={prev} title="Anterioara"
                                className={`${overlayBtn} absolute left-3 top-1/2 -translate-y-1/2 sm:opacity-0 sm:group-hover:opacity-100`}>
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}
                        {currentIndex < count - 1 && (
                            <button type="button" onClick={next} title="Următoarea"
                                className={`${overlayBtn} absolute right-3 top-1/2 -translate-y-1/2 sm:opacity-0 sm:group-hover:opacity-100`}>
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        )}

                        <div className="absolute top-3 right-3 flex gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => setLightboxOpen(true)} title="Ecran complet" className={overlayBtn}>
                                <Maximize2 className="w-4 h-4" />
                            </button>
                            {canModify && (
                                <button type="button" onClick={() => setDeleteTarget(current)} title="Șterge imaginea" className={`${overlayBtn} hover:bg-red-600/90`}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Indicator puncte (doar pe mobil, unde săgețile de hover nu există) */}
                        {count > 1 && count <= 10 && (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 sm:hidden">
                                {images.map((img, i) => (
                                    <span key={img.id} className={`h-1.5 rounded-full transition-all ${i === currentIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Thumbnails */}
                    {(count > 1 || canModify) && (
                        <div className="flex gap-2 mt-2 overflow-x-auto p-1 -mx-1">
                            {images.map((img, i) => (
                                <button
                                    key={img.id}
                                    type="button"
                                    onClick={() => setIndex(i)}
                                    title={`Imaginea ${i + 1}`}
                                    className={`relative shrink-0 w-12 h-12 rounded-md overflow-hidden transition-all cursor-pointer ${
                                        i === currentIndex
                                            ? "ring-2 ring-[#5AC4C2] ring-offset-2 " + (dark ? "ring-offset-[#1e1c3a]" : "ring-offset-white")
                                            : "opacity-60 hover:opacity-100"
                                    } ${dark ? "bg-[#2d2b52]" : "bg-gray-100"}`}
                                >
                                    {urls[img.id]
                                        ? <img src={urls[img.id]} alt="" className="w-full h-full object-cover" draggable={false} />
                                        : <Loader2 className={`w-4 h-4 m-auto animate-spin ${muted}`} />}
                                </button>
                            ))}
                            {canModify && count < MAX_IMAGES && (
                                <button
                                    type="button"
                                    onClick={() => inputRef.current?.click()}
                                    disabled={uploading}
                                    title="Adaugă imagini"
                                    className={`shrink-0 w-12 h-12 rounded-md border-2 border-dashed flex items-center justify-center transition-colors cursor-pointer disabled:cursor-wait ${
                                        dark ? "border-[#3a3768] text-[#6b68a0] hover:border-[#524E91] hover:text-[#9b98c8]" : "border-gray-200 text-gray-400 hover:border-[#524E91] hover:text-[#524E91]"
                                    }`}
                                >
                                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

            {/* Overlay drag & drop peste toată secțiunea */}
            {dragOver && count > 0 && (
                <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-[#5AC4C2] bg-[#5AC4C2]/10 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <ImagePlus className="w-7 h-7 text-[#5AC4C2]" />
                    <span className={`text-sm font-medium ${dark ? "text-white" : "text-gray-900"}`}>Eliberează pentru a adăuga</span>
                </div>
            )}

            {/* Lightbox */}
            <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
                <DialogContent className="sm:max-w-5xl p-0 overflow-hidden bg-black/95 ring-white/10 text-white" showCloseButton>
                    <DialogTitle className="sr-only">{task.title}</DialogTitle>
                    {current && (
                        <div className="relative flex items-center justify-center min-h-[50vh]" {...swipeHandlers}>
                            {urls[current.id]
                                ? <img key={current.id} src={urls[current.id]} alt={task.title} className="max-h-[85vh] w-auto max-w-full object-contain animate-in fade-in-0 duration-200" draggable={false} />
                                : <Loader2 className="w-6 h-6 animate-spin text-white/60" />}

                            {currentIndex > 0 && (
                                <button type="button" onClick={prev} className={`${overlayBtn} absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11`}>
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                            )}
                            {currentIndex < count - 1 && (
                                <button type="button" onClick={next} className={`${overlayBtn} absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11`}>
                                    <ChevronRight className="w-6 h-6" />
                                </button>
                            )}
                            {count > 1 && (
                                <>
                                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/60 text-xs font-medium tabular-nums">
                                        {currentIndex + 1} / {count}
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Confirmare ștergere */}
            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent className="max-w-sm">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-rose-500/15 shrink-0">
                                <Trash2 className="w-5 h-5 text-rose-500" />
                            </div>
                            <AlertDialogTitle className="text-base">Ștergi imaginea?</AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="pl-12">
                            Imaginea va fi ștearsă definitiv de pe acest task. Această acțiune este ireversibilă.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-2">
                        <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Anulează</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-500 text-white">Șterge</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
