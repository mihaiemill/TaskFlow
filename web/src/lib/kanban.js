// Logica de drag & drop a tablei kanban (fără React) — folosită de ProjectDetailPage și testată separat.

// Mută/repoziționează taskul `activeId` pe poziția `targetIndex` (0-based) în coloana
// `targetStatus`, păstrând ordinea relativă a celorlalte taskuri neschimbată.
export function reorderTasks(tasks, activeId, targetStatus, targetIndex) {
    const active = tasks.find(t => t.id === activeId);
    if (!active) return tasks;
    const rest = tasks.filter(t => t.id !== activeId);
    const targetColumnTasks = rest.filter(t => t.status === targetStatus);
    const idx = Math.max(0, Math.min(targetIndex, targetColumnTasks.length));
    const movedTask = active.status === targetStatus ? active : { ...active, status: targetStatus };

    if (idx >= targetColumnTasks.length) return [...rest, movedTask];

    const insertPos = rest.findIndex(t => t.id === targetColumnTasks[idx].id);
    const result = [...rest];
    result.splice(insertPos, 0, movedTask);
    return result;
}

// Poziția finală (0-based) în coloana țintă la drop, cu semantica arrayMove din dnd-kit:
// taskul ajunge exact pe locul elementului peste care a fost lăsat. `overId` poate fi un task
// sau coloana însăși (drop pe zona goală → la final).
export function dropIndex(tasks, activeId, overId, targetStatus) {
    const col = tasks.filter(t => t.status === targetStatus);
    const fromIndex = col.findIndex(t => t.id === activeId);
    const overIndex = col.findIndex(t => t.id === overId);
    if (fromIndex === -1) return overIndex === -1 ? col.length : overIndex;
    return overIndex === -1 ? col.length - 1 : overIndex;
}
