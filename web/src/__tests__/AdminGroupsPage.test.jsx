import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../components/ui/Sidebar.jsx", async () => (await import("../test/pageMocks.js")).sidebarMock);
vi.mock("../components/ui/Topbar.jsx", async () => (await import("../test/pageMocks.js")).topbarMock);
vi.mock("../context/ThemeContext.jsx", async () => (await import("../test/pageMocks.js")).themeMock);
vi.mock("../context/ProjectsContext.jsx", async () => (await import("../test/pageMocks.js")).projectsMock);
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => ({ token: "admin-token" }) }));

import AdminGroupsPage from "../pages/AdminGroupsPage.jsx";
import { renderAt, mockFetch, callsTo } from "../test/utils.jsx";

const ANA = { id: "u1", fullName: "Ana Pop", email: "ana@test.ro" };
const DAN = { id: "u2", fullName: "Dan Ionescu", email: "dan@test.ro" };
const ELA = { id: "u3", fullName: "Ela Marin", email: "ela@test.ro" };

let fetchMock;
function setup({ groups, users = [ANA, DAN, ELA] }) {
    fetchMock = mockFetch({
        "GET /api/admin/users": users,
        "GET /api/admin/groups": groups,
        "GET /api/admin/assignments": [],
        // PUT întoarce grupul cu membrii trimiși (ca backend-ul)
        "PUT /api/admin/groups/1": init => {
            const { name, userIds } = JSON.parse(init.body);
            return { id: 1, name, permissionLevel: 2, users: users.filter(u => userIds.includes(u.id)) };
        },
        "PUT /api/admin/groups/1/permissions": init => ({ id: 1, ...JSON.parse(init.body) }),
        "POST /api/admin/groups": init => {
            const { name, userIds } = JSON.parse(init.body);
            return { id: 9, name, permissionLevel: 1, users: users.filter(u => userIds.includes(u.id)) };
        },
    });
    return renderAt("/admin/groups", "/admin/groups", <AdminGroupsPage />);
}

const bodyOf = call => JSON.parse(call[1].body);
const groupCard = async name => (await screen.findByText(name, { selector: "p" })).closest("div.rounded-2xl");

beforeEach(() => { fetchMock = undefined; });

describe("AdminGroupsPage — adăugare utilizatori în grup", () => {
    it("pop-up-ul arată doar utilizatorii care NU sunt deja în grup", async () => {
        setup({ groups: [{ id: 1, name: "Echipa", permissionLevel: 2, users: [ANA] }] });

        await userEvent.click(await screen.findByTitle("Adauga utilizatori in grup"));

        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByText("Dan Ionescu")).toBeInTheDocument();
        expect(within(dialog).getByText("Ela Marin")).toBeInTheDocument();
        expect(within(dialog).queryByText("Ana Pop")).not.toBeInTheDocument();
    });

    it("adaugă utilizatorii selectați, păstrându-i pe cei existenți", async () => {
        setup({ groups: [{ id: 1, name: "Echipa", permissionLevel: 2, users: [ANA] }] });
        await userEvent.click(await screen.findByTitle("Adauga utilizatori in grup"));
        const dialog = await screen.findByRole("dialog");

        await userEvent.click(within(dialog).getByText("Dan Ionescu"));
        await userEvent.click(within(dialog).getByRole("button", { name: "Adaugă în grup" }));

        await waitFor(() => expect(callsTo(fetchMock, "PUT", "/api/admin/groups/1")).toHaveLength(1));
        expect(bodyOf(callsTo(fetchMock, "PUT", "/api/admin/groups/1")[0])).toEqual({ name: "Echipa", userIds: ["u1", "u2"] });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(within(await groupCard("Echipa")).getByText("2 utilizatori")).toBeInTheDocument();
    });

    it("butonul de adăugare e dezactivat până selectezi pe cineva", async () => {
        setup({ groups: [{ id: 1, name: "Echipa", permissionLevel: 2, users: [ANA] }] });
        await userEvent.click(await screen.findByTitle("Adauga utilizatori in grup"));

        expect(within(await screen.findByRole("dialog")).getByRole("button", { name: "Adaugă în grup" })).toBeDisabled();
    });

    it("căutarea din pop-up filtrează candidații", async () => {
        setup({ groups: [{ id: 1, name: "Echipa", permissionLevel: 2, users: [ANA] }] });
        await userEvent.click(await screen.findByTitle("Adauga utilizatori in grup"));
        const dialog = await screen.findByRole("dialog");

        await userEvent.type(within(dialog).getByPlaceholderText("Cauta utilizator..."), "ela");

        expect(within(dialog).getByText("Ela Marin")).toBeInTheDocument();
        expect(within(dialog).queryByText("Dan Ionescu")).not.toBeInTheDocument();
    });

    it("toți utilizatorii sunt deja în grup → mesaj, fără listă", async () => {
        setup({ groups: [{ id: 1, name: "Echipa", permissionLevel: 2, users: [ANA, DAN, ELA] }] });

        await userEvent.click(await screen.findByTitle("Adauga utilizatori in grup"));

        expect(within(await screen.findByRole("dialog")).getByText("Toți utilizatorii sunt deja în acest grup.")).toBeInTheDocument();
    });

    it("grup gol → butonul „Adaugă” apare lângă mesajul „Niciun utilizator în grup”", async () => {
        setup({ groups: [{ id: 1, name: "Echipa", permissionLevel: 2, users: [] }] });

        const card = await groupCard("Echipa");
        expect(within(card).getByText("Niciun utilizator în grup.")).toBeInTheDocument();
        expect(within(card).getByTitle("Adauga utilizatori in grup")).toBeInTheDocument();
    });
});

describe("AdminGroupsPage — alte acțiuni pe grup", () => {
    it("scoate un utilizator din grup", async () => {
        setup({ groups: [{ id: 1, name: "Echipa", permissionLevel: 2, users: [ANA, DAN] }] });

        await userEvent.click(await screen.findByTitle("Scoate pe Dan Ionescu din grup"));

        await waitFor(() => expect(callsTo(fetchMock, "PUT", "/api/admin/groups/1")).toHaveLength(1));
        expect(bodyOf(callsTo(fetchMock, "PUT", "/api/admin/groups/1")[0]).userIds).toEqual(["u1"]);
    });

    it("schimbă nivelul de permisiune", async () => {
        setup({ groups: [{ id: 1, name: "Echipa", permissionLevel: 2, users: [ANA] }] });

        await userEvent.click(within(await groupCard("Echipa")).getByRole("button", { name: "Sterg." }));

        await waitFor(() => expect(callsTo(fetchMock, "PUT", "/api/admin/groups/1/permissions")).toHaveLength(1));
        expect(bodyOf(callsTo(fetchMock, "PUT", "/api/admin/groups/1/permissions")[0])).toEqual({ permissionLevel: 3 });
    });

    it("creează un grup nou cu utilizatorii selectați", async () => {
        setup({ groups: [] });

        await userEvent.click(await screen.findByRole("button", { name: /Grup nou/ }));
        await userEvent.type(await screen.findByPlaceholderText("Numele grupului..."), "Designeri");
        const sheet = screen.getByRole("dialog");
        await userEvent.click(within(sheet).getByText("Ela Marin"));
        await userEvent.click(within(sheet).getByRole("button", { name: "Creeaza grupul" }));

        await waitFor(() => expect(callsTo(fetchMock, "POST", "/api/admin/groups")).toHaveLength(1));
        expect(bodyOf(callsTo(fetchMock, "POST", "/api/admin/groups")[0])).toEqual({ name: "Designeri", userIds: ["u3"] });
    });

    it("grup nou cu un nume deja folosit → propune adăugarea la grupul existent", async () => {
        setup({ groups: [{ id: 1, name: "Echipa", permissionLevel: 2, users: [ANA] }] });

        await userEvent.click(await screen.findByRole("button", { name: /Grup nou/ }));
        await userEvent.type(await screen.findByPlaceholderText("Numele grupului..."), "echipa");
        await userEvent.click(within(screen.getByRole("dialog")).getByText("Dan Ionescu"));
        await userEvent.click(screen.getByRole("button", { name: "Creeaza grupul" }));

        expect(await screen.findByText("Grup existent")).toBeInTheDocument();
        expect(callsTo(fetchMock, "POST", "/api/admin/groups")).toHaveLength(0);
    });
});
