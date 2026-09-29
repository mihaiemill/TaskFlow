import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useNavigate, useParams } from "react-router-dom";

vi.mock("../components/ui/Sidebar.jsx", async () => (await import("../test/pageMocks.js")).sidebarMock);
vi.mock("../components/ui/Topbar.jsx", async () => (await import("../test/pageMocks.js")).topbarMock);
vi.mock("../context/ThemeContext.jsx", async () => (await import("../test/pageMocks.js")).themeMock);
vi.mock("../context/ProjectsContext.jsx", async () => (await import("../test/pageMocks.js")).projectsMock);
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "admin-token" }) }));

import AdminDashboardPage from "../pages/AdminDashboardPage.jsx";
import { renderAt, mockFetch, callsTo } from "../test/utils.jsx";

const USERS = [
    { id: "u1", fullName: "Ana Pop", email: "ana@test.ro", createdAt: "2026-09-01T00:00:00Z" },
    { id: "u2", fullName: "Dan Ionescu", email: "dan@test.ro", createdAt: "2026-09-02T00:00:00Z" },
];
const PROJECTS = [
    { id: "p1", name: "Alfa", ownerName: "Ana Pop", ownerEmail: "ana@test.ro", color: "#524E91", doneTasks: 1, totalTasks: 2, assignments: [], createdAt: "2026-09-01T00:00:00Z" },
    { id: "p2", name: "Beta", ownerName: "Dan Ionescu", ownerEmail: "dan@test.ro", color: "#5AC4C2", doneTasks: 0, totalTasks: 0, assignments: [], createdAt: "2026-09-02T00:00:00Z" },
];
const TASKS = [
    { id: "t1", title: "Scrie teste", ownerName: "Ana Pop", projectName: "Alfa", projectColor: "#524E91", status: "Todo", priority: "High" },
    { id: "t2", title: "Repară bug", ownerName: "Dan Ionescu", projectName: "Beta", projectColor: "#5AC4C2", status: "Done", priority: "Low" },
];

let fetchMock;
beforeEach(() => {
    fetchMock = mockFetch({
        "GET /api/admin/stats": { usersCount: 2, projectsCount: 2, tasksCount: 2 },
        "GET /api/admin/users": USERS,
        "GET /api/admin/projects": PROJECTS,
        "GET /api/admin/tasks": TASKS,
    });
});

function ProjectPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    return <div><p>Pagina proiectului {id}</p><button onClick={() => navigate(-1)}>Înapoi</button></div>;
}
function TaskPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    return <div><p>Pagina taskului {id}</p><button onClick={() => navigate(-1)}>Înapoi</button></div>;
}

const renderDashboard = (url = "/admin") => renderAt(url, "/admin", <AdminDashboardPage />, [
    { path: "/projects/:id", element: <ProjectPage /> },
    { path: "/tasks/:id", element: <TaskPage /> },
]);

describe("AdminDashboardPage", () => {
    it("afișează statisticile și, implicit, lista de utilizatori", async () => {
        renderDashboard();

        expect(await screen.findByText("Ana Pop")).toBeInTheDocument();
        expect(screen.getByText("Dan Ionescu")).toBeInTheDocument();
        expect(callsTo(fetchMock, "GET", "/api/admin/users")).toHaveLength(1);
    });

    it("?tab=projects → deschide direct cardul Proiecte", async () => {
        renderDashboard("/admin?tab=projects");

        expect(await screen.findByText("Alfa")).toBeInTheDocument();
        expect(callsTo(fetchMock, "GET", "/api/admin/projects")).toHaveLength(1);
        expect(callsTo(fetchMock, "GET", "/api/admin/users")).toHaveLength(0);
    });

    it("click pe card → schimbă lista și pune tab-ul în URL", async () => {
        renderDashboard();
        await screen.findByText("Ana Pop");

        await userEvent.click(screen.getByRole("button", { name: /Task-uri/ }));

        expect(await screen.findByText("Scrie teste")).toBeInTheDocument();
        expect(screen.getByTestId("location")).toHaveTextContent("/admin?tab=tasks");
    });

    it("click din nou pe cardul activ → închide lista (?tab=none)", async () => {
        renderDashboard("/admin?tab=projects");
        await screen.findByText("Alfa");

        await userEvent.click(screen.getByRole("button", { name: /Proiecte/ }));

        expect(await screen.findByText(/Selecteaza un card/)).toBeInTheDocument();
        expect(screen.getByTestId("location")).toHaveTextContent("/admin?tab=none");
    });

    it("click pe un proiect → pagina proiectului; Back → înapoi pe cardul Proiecte", async () => {
        renderDashboard("/admin?tab=projects");

        await userEvent.click(await screen.findByTitle("Deschide proiectul Alfa"));
        expect(await screen.findByText("Pagina proiectului p1")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Înapoi" }));

        expect(await screen.findByText("Alfa")).toBeInTheDocument();
        expect(screen.getByTestId("location")).toHaveTextContent("/admin?tab=projects");
    });

    it("click pe un task → pagina taskului; Back → înapoi pe cardul Task-uri", async () => {
        renderDashboard("/admin?tab=tasks");

        await userEvent.click(await screen.findByTitle("Deschide task-ul Repară bug"));
        expect(await screen.findByText("Pagina taskului t2")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Înapoi" }));

        expect(await screen.findByText("Scrie teste")).toBeInTheDocument();
    });

    it("schimbarea cardului nu adaugă intrări în istoric (Back iese din dashboard)", async () => {
        renderDashboard();
        await screen.findByText("Ana Pop");

        await userEvent.click(screen.getByRole("button", { name: /Proiecte/ }));
        await userEvent.click(screen.getByRole("button", { name: /Task-uri/ }));
        await userEvent.click(await screen.findByTitle("Deschide task-ul Scrie teste"));
        await userEvent.click(await screen.findByRole("button", { name: "Înapoi" }));

        // o singură pagină înapoi → dashboard-ul, pe ultimul card ales
        expect(await screen.findByText("Scrie teste")).toBeInTheDocument();
        expect(screen.getByTestId("location")).toHaveTextContent("/admin?tab=tasks");
    });

    it("căutarea filtrează lista", async () => {
        renderDashboard("/admin?tab=projects");
        await screen.findByText("Alfa");

        await userEvent.type(screen.getByPlaceholderText(/Cauta dupa proiect/), "beta");

        await waitFor(() => expect(screen.queryByText("Alfa")).not.toBeInTheDocument());
        expect(screen.getByText("Beta")).toBeInTheDocument();
    });
});
