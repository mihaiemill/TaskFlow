import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../components/ui/Sidebar.jsx", async () => (await import("../test/pageMocks.js")).sidebarMock);
vi.mock("../components/ui/Topbar.jsx", async () => (await import("../test/pageMocks.js")).topbarMock);
vi.mock("../context/ThemeContext.jsx", async () => (await import("../test/pageMocks.js")).themeMock);
vi.mock("../context/ProjectsContext.jsx", async () => (await import("../test/pageMocks.js")).projectsMock);
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "admin-token", setAvatar: () => {} }) }));

import AdminUsersPage from "../pages/AdminUsersPage.jsx";
import { renderAt, mockFetch, callsTo } from "../test/utils.jsx";

const base = { createdAt: "2026-09-01T00:00:00Z", avatar: null, projectsCount: 0, tasksAssignedCount: 0 };
const ADMIN = { ...base, id: "a0", fullName: "Admin", email: "admin@admin.com", hasPassword: true, isGoogleLinked: false, isActive: true, isSelf: true };
const ANA = { ...base, id: "u1", fullName: "Ana Pop", email: "ana@test.ro", hasPassword: true, isGoogleLinked: false, isActive: true, isSelf: false };
const GOOGLE = { ...base, id: "u2", fullName: "Gigi Google", email: "gigi@gmail.com", hasPassword: false, isGoogleLinked: true, isActive: true, isSelf: false };

let fetchMock;
function setup() {
    fetchMock = mockFetch({
        "GET /api/admin/users": [ADMIN, ANA, GOOGLE],
        "PATCH /api/admin/users/u1/name": init => ({ id: "u1", fullName: JSON.parse(init.body).fullName }),
        "PATCH /api/admin/users/u2/name": init => ({ id: "u2", fullName: JSON.parse(init.body).fullName }),
        "PATCH /api/admin/users/u1/password": { status: 204, body: null },
        "PATCH /api/admin/users/u1/status": init => ({ id: "u1", ...JSON.parse(init.body) }),
    });
    return renderAt("/admin/users", "/admin/users", <AdminUsersPage />);
}

const row = async name => (await screen.findByText(name, { selector: "p" })).closest("tr");

async function openEdit(name) {
    const r = await row(name);
    await userEvent.click(within(r).getByTitle(/Editează numele/));
    return screen.findByRole("dialog");
}

describe("AdminUsersPage — editare nume / parolă (independente)", () => {
    it("doar numele → trimite doar numele, parola rămâne neatinsă", async () => {
        setup();
        const dialog = await openEdit("Ana Pop");

        const name = within(dialog).getByPlaceholderText("Ion Popescu");
        await userEvent.clear(name);
        await userEvent.type(name, "Ana Ionescu");
        await userEvent.click(within(dialog).getByRole("button", { name: "Salvează" }));

        await waitFor(() => expect(callsTo(fetchMock, "PATCH", "/api/admin/users/u1/name")).toHaveLength(1));
        expect(JSON.parse(callsTo(fetchMock, "PATCH", "/api/admin/users/u1/name")[0][1].body)).toEqual({ fullName: "Ana Ionescu" });
        expect(callsTo(fetchMock, "PATCH", "/api/admin/users/u1/password")).toHaveLength(0);
        expect(await screen.findByText("Ana Ionescu", { selector: "p" })).toBeInTheDocument();
    });

    it("doar parola → trimite doar parola", async () => {
        setup();
        const dialog = await openEdit("Ana Pop");

        await userEvent.type(within(dialog).getByPlaceholderText("Minim 6 caractere"), "parolanoua");
        await userEvent.click(within(dialog).getByRole("button", { name: "Salvează" }));

        await waitFor(() => expect(callsTo(fetchMock, "PATCH", "/api/admin/users/u1/password")).toHaveLength(1));
        expect(JSON.parse(callsTo(fetchMock, "PATCH", "/api/admin/users/u1/password")[0][1].body)).toEqual({ newPassword: "parolanoua" });
        expect(callsTo(fetchMock, "PATCH", "/api/admin/users/u1/name")).toHaveLength(0);
    });

    it("nume + parolă → trimite ambele", async () => {
        setup();
        const dialog = await openEdit("Ana Pop");

        await userEvent.type(within(dialog).getByPlaceholderText("Ion Popescu"), " M.");
        await userEvent.type(within(dialog).getByPlaceholderText("Minim 6 caractere"), "parolanoua");
        await userEvent.click(within(dialog).getByRole("button", { name: "Salvează" }));

        await waitFor(() => expect(callsTo(fetchMock, "PATCH", "/api/admin/users/u1/password")).toHaveLength(1));
        expect(callsTo(fetchMock, "PATCH", "/api/admin/users/u1/name")).toHaveLength(1);
    });

    it("nimic modificat → mesaj, fără cereri", async () => {
        setup();
        const dialog = await openEdit("Ana Pop");

        await userEvent.click(within(dialog).getByRole("button", { name: "Salvează" }));

        expect(await within(dialog).findByText("Nu ai modificat nimic.")).toBeInTheDocument();
        expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
    });

    it("parolă prea scurtă → eroare, fără cereri", async () => {
        setup();
        const dialog = await openEdit("Ana Pop");

        await userEvent.type(within(dialog).getByPlaceholderText("Minim 6 caractere"), "123");
        await userEvent.click(within(dialog).getByRole("button", { name: "Salvează" }));

        expect(await within(dialog).findByText(/cel puțin 6 caractere/)).toBeInTheDocument();
        expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
    });

    it("nume gol → eroare", async () => {
        setup();
        const dialog = await openEdit("Ana Pop");

        await userEvent.clear(within(dialog).getByPlaceholderText("Ion Popescu"));
        await userEvent.click(within(dialog).getByRole("button", { name: "Salvează" }));

        expect(await within(dialog).findByText("Numele nu poate fi gol.")).toBeInTheDocument();
    });

    it("cont Google → doar câmpul de nume, fără parolă", async () => {
        setup();
        const dialog = await openEdit("Gigi Google");

        expect(within(dialog).getByText(/Cont Google — se poate schimba doar numele/)).toBeInTheDocument();
        expect(within(dialog).queryByPlaceholderText("Minim 6 caractere")).not.toBeInTheDocument();
    });
});

describe("AdminUsersPage — activ / inactiv", () => {
    it("dezactivează un utilizator", async () => {
        setup();

        await userEvent.click(within(await row("Ana Pop")).getByRole("button", { name: "Activ" }));

        await waitFor(() => expect(callsTo(fetchMock, "PATCH", "/api/admin/users/u1/status")).toHaveLength(1));
        expect(JSON.parse(callsTo(fetchMock, "PATCH", "/api/admin/users/u1/status")[0][1].body)).toEqual({ isActive: false });
        expect(within(await row("Ana Pop")).getByRole("button", { name: "Inactiv" })).toBeInTheDocument();
    });

    it("propriul cont (admin) nu poate fi dezactivat și nu are buton de ștergere", async () => {
        setup();
        const adminRow = await row("Admin");

        expect(within(adminRow).getByRole("button", { name: "Activ" })).toBeDisabled();
        expect(within(adminRow).queryByTitle("Șterge utilizatorul")).not.toBeInTheDocument();
    });
});
