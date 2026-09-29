import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../components/ui/Sidebar.jsx", async () => (await import("../test/pageMocks.js")).sidebarMock);
vi.mock("../components/ui/Topbar.jsx", async () => (await import("../test/pageMocks.js")).topbarMock);
vi.mock("../context/ThemeContext.jsx", async () => (await import("../test/pageMocks.js")).themeMock);
vi.mock("../context/ProjectsContext.jsx", async () => (await import("../test/pageMocks.js")).projectsMock);
vi.mock("../context/SidebarContext.jsx", async () => (await import("../test/pageMocks.js")).sidebarStateMock);
vi.mock("../context/FavoritesContext.jsx", async () => (await import("../test/pageMocks.js")).favoritesMock);

const auth = vi.hoisted(() => ({ token: "" }));
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: auth.token }) }));
vi.mock("../api/axiosInstance.js", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from "../api/axiosInstance.js";
import ProjectDetailPage from "../pages/ProjectDetailPage.jsx";
import { renderAt, fakeToken } from "../test/utils.jsx";

const USER_TOKEN = fakeToken({ sub: "u1", email: "ana@test.ro" });
const ADMIN_TOKEN = fakeToken({ sub: "a0", email: "admin@admin.com" });

const TASKS = [
    { id: "t1", title: "Scrie teste", status: "Todo", priority: "High", projectId: "p1", order: 0 },
    { id: "t2", title: "Repară bug", status: "InProgress", priority: "Low", projectId: "p1", order: 0 },
];
const assignee = (id, name, type = "user", isOwner = false) => ({ id, name, type, isOwner });
const FIVE = [
    assignee("u1", "Ana Pop", "user", true),
    assignee("u2", "Dan Ionescu"),
    assignee("g1", "Designeri", "group"),
    assignee("u3", "Ela Marin"),
    assignee("g2", "Testeri", "group"),
];

function setup({ permission = 3, assignees = FIVE, token = USER_TOKEN } = {}) {
    auth.token = token;
    vi.mocked(api.get).mockImplementation(async url => {
        const data = {
            "/projects/p1": { id: "p1", name: "Proiect Alfa", color: "#524E91", myPermission: permission },
            "/projects/p1/tasks": TASKS,
            "/projects/p1/assignments": assignees,
            "/admin/users": [], "/admin/groups": [], "/admin/projects/p1/assignments": [],
        }[url];
        if (data === undefined) throw new Error(`GET nesimulat: ${url}`);
        return { data };
    });
    return renderAt("/projects/p1", "/projects/:id", <ProjectDetailPage />);
}

// Pagina randează și varianta mobilă, și cea desktop (jsdom nu aplică media query-urile)
const desktopCard = async title => (await screen.findAllByText(title)).at(-1).closest("[aria-roledescription='sortable']");

// cu acolade: o funcție întoarsă din beforeEach e tratată de Vitest ca teardown și apelată după test
beforeEach(() => { vi.mocked(api.get).mockReset(); });

describe("ProjectDetailPage — asignați", () => {
    it("cel mult 3 asignați → toți vizibili, fără „Vizualizează tot”", async () => {
        setup({ assignees: FIVE.slice(0, 3) });

        expect(await screen.findByText("Designeri")).toBeInTheDocument();
        expect(screen.getByText("Dan Ionescu")).toBeInTheDocument();
        expect(screen.queryByText(/Vizualizează tot/)).not.toBeInTheDocument();
    });

    it("peste 3 asignați → primii 3 + chip „+2 · Vizualizează tot”", async () => {
        setup();

        expect(await screen.findByText("+2 · Vizualizează tot")).toBeInTheDocument();
        expect(screen.getByText("Designeri")).toBeInTheDocument();
        expect(screen.queryByText("Ela Marin")).not.toBeInTheDocument();
        expect(screen.queryByText("Testeri")).not.toBeInTheDocument();
    });

    it("„Vizualizează tot” → pop-up cu toți asignații, pe secțiuni", async () => {
        setup();

        await userEvent.click(await screen.findByText("+2 · Vizualizează tot"));

        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByText(/Utilizatori/)).toHaveTextContent("Utilizatori (3)");
        expect(within(dialog).getByText(/Grupuri/)).toHaveTextContent("Grupuri (2)");
        for (const name of ["Ana Pop", "Dan Ionescu", "Ela Marin", "Designeri", "Testeri"])
            expect(within(dialog).getByText(name)).toBeInTheDocument();
    });

    it("pe mobil: rezumatul compact „5 asignați” deschide același pop-up", async () => {
        setup();

        const summary = (await screen.findByText("5 asignați")).closest("button");
        expect(summary).toHaveTextContent("Ana Pop, Dan Ionescu, Designeri, Ela Marin, Testeri");
        await userEvent.click(summary);

        expect(await screen.findByRole("dialog")).toHaveTextContent("Grupuri (2)");
    });

    it("utilizator obișnuit → fără butoane de eliminare / Asignează", async () => {
        setup();
        await screen.findByText("Designeri");

        expect(screen.queryByTitle(/Elimină .* din proiect/)).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Asignează/ })).not.toBeInTheDocument();
    });

    it("admin → poate elimina asignații, dar nu și owner-ul", async () => {
        setup({ token: ADMIN_TOKEN });
        await screen.findByText("Designeri");

        expect(screen.getAllByTitle("Elimină Dan Ionescu din proiect").length).toBeGreaterThan(0);
        expect(screen.queryByTitle("Elimină Ana Pop din proiect")).not.toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: /Asignează/ }).length).toBeGreaterThan(0);
    });
});

describe("ProjectDetailPage — permisiuni în interfață", () => {
    it("Vizualizare → cardurile nu pot fi trase, fără editare / ștergere / task nou", async () => {
        setup({ permission: 1 });
        const card = await desktopCard("Scrie teste");

        expect(card).toHaveAttribute("aria-disabled", "true");
        expect(within(card).queryByTitle("Editează task")).not.toBeInTheDocument();
        expect(within(card).queryByTitle("Șterge task")).not.toBeInTheDocument();
        expect(screen.queryByTitle("Task nou")).not.toBeInTheDocument();
    });

    it("Modificare → poate trage și edita, dar nu șterge", async () => {
        setup({ permission: 2 });
        const card = await desktopCard("Scrie teste");

        await waitFor(() => expect(card).toHaveAttribute("aria-disabled", "false"));
        expect(within(card).getByTitle("Editează task")).toBeInTheDocument();
        expect(within(card).queryByTitle("Șterge task")).not.toBeInTheDocument();
        expect(screen.getByTitle("Task nou")).toBeInTheDocument();
    });

    it("Ștergere → are toate acțiunile", async () => {
        setup({ permission: 3 });
        const card = await desktopCard("Scrie teste");

        await waitFor(() => expect(within(card).getByTitle("Editează task")).toBeInTheDocument());
        expect(within(card).getByTitle("Șterge task")).toBeInTheDocument();
    });
});

describe("ProjectDetailPage — căutare", () => {
    it("căutarea ascunde taskurile care nu se potrivesc", async () => {
        setup();
        await desktopCard("Repară bug");

        await userEvent.type(screen.getByPlaceholderText("Caută taskuri..."), "teste");

        await waitFor(() => expect(screen.queryByText("Repară bug")).not.toBeInTheDocument());
        expect(screen.getAllByText("Scrie teste").length).toBeGreaterThan(0);
    });
});
