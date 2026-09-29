import { describe, it, expect } from "vitest";
import { reorderTasks, dropIndex } from "../lib/kanban.js";

const t = (id, status = "Todo") => ({ id, status });
const column = (tasks, status) => tasks.filter(x => x.status === status).map(x => x.id);

describe("reorderTasks", () => {
    it("mută un task în jos în aceeași coloană", () => {
        const tasks = [t("A"), t("B"), t("C")];
        expect(column(reorderTasks(tasks, "A", "Todo", 2), "Todo")).toEqual(["B", "C", "A"]);
    });

    it("mută un task în sus în aceeași coloană", () => {
        const tasks = [t("A"), t("B"), t("C")];
        expect(column(reorderTasks(tasks, "C", "Todo", 0), "Todo")).toEqual(["C", "A", "B"]);
    });

    it("mută un task în altă coloană pe poziția cerută și îi schimbă statusul", () => {
        const tasks = [t("A"), t("B"), t("X", "Done"), t("Y", "Done")];
        const result = reorderTasks(tasks, "A", "Done", 1);
        expect(column(result, "Todo")).toEqual(["B"]);
        expect(column(result, "Done")).toEqual(["X", "A", "Y"]);
        expect(result.find(x => x.id === "A").status).toBe("Done");
    });

    it("poziție prea mare → la finalul coloanei", () => {
        const tasks = [t("A"), t("B")];
        expect(column(reorderTasks(tasks, "A", "Todo", 99), "Todo")).toEqual(["B", "A"]);
    });

    it("nu modifică lista originală și ignoră un id necunoscut", () => {
        const tasks = [t("A"), t("B")];
        const copy = structuredClone(tasks);
        reorderTasks(tasks, "A", "Done", 0);
        expect(tasks).toEqual(copy);
        expect(reorderTasks(tasks, "nu-exista", "Done", 0)).toBe(tasks);
    });
});

describe("dropIndex (semantica arrayMove din dnd-kit)", () => {
    it("drop peste alt task din aceeași coloană → locul acelui task (inclusiv mutare cu o poziție în jos)", () => {
        const tasks = [t("A"), t("B"), t("C")];
        expect(dropIndex(tasks, "A", "B", "Todo")).toBe(1);
        expect(dropIndex(tasks, "A", "C", "Todo")).toBe(2);
        expect(dropIndex(tasks, "C", "A", "Todo")).toBe(0);
    });

    it("drop pe propria poziție → poziția neschimbată", () => {
        expect(dropIndex([t("A"), t("B")], "B", "B", "Todo")).toBe(1);
    });

    it("drop pe zona goală a coloanei → la final", () => {
        expect(dropIndex([t("A"), t("B"), t("X", "Done")], "A", "Todo", "Todo")).toBe(1);
        expect(dropIndex([t("A"), t("X", "Done")], "A", "Done", "Done")).toBe(1);
    });

    it("task încă în altă coloană (fără live preview) → înaintea taskului peste care e lăsat", () => {
        const tasks = [t("A"), t("X", "Done"), t("Y", "Done")];
        expect(dropIndex(tasks, "A", "Y", "Done")).toBe(1);
    });

    it("rezultatul, aplicat cu reorderTasks, dă ordinea așteptată", () => {
        const tasks = [t("A"), t("B"), t("C")];
        const index = dropIndex(tasks, "A", "B", "Todo");
        expect(column(reorderTasks(tasks, "A", "Todo", index), "Todo")).toEqual(["B", "A", "C"]);
    });
});
