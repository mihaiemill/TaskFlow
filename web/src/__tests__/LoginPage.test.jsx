import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../api/axiosInstance.js", () => ({ default: { post: vi.fn(), get: vi.fn() } }));

import api from "../api/axiosInstance.js";
import LoginPage from "../pages/LoginPage.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";
import { ThemeProvider } from "../context/ThemeContext.jsx";
import { renderAt, mockFetch } from "../test/utils.jsx";

function renderLogin(url = "/login") {
    return renderAt(url, "/login",
        <ThemeProvider><AuthProvider><LoginPage /></AuthProvider></ThemeProvider>,
        [{ path: "/projects", element: <p>Pagina de proiecte</p> }]);
}

async function submit(email = "ana@test.ro", password = "parola123") {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), email);
    await user.type(screen.getByLabelText("Parolă"), password);
    await user.click(screen.getByRole("button", { name: "Intră în cont" }));
}

const httpError = (status, data) => Object.assign(new Error("http"), { response: { status, data } });

beforeEach(() => {
    vi.mocked(api.post).mockReset();
    mockFetch({ "GET /api/auth/me": { hasPassword: true, avatar: null } });
});

describe("LoginPage", () => {
    it("login reușit → salvează token-ul și merge la /projects", async () => {
        vi.mocked(api.post).mockResolvedValue({ data: { token: "tok-123" } });
        renderLogin();

        await submit();

        expect(api.post).toHaveBeenCalledWith("/auth/login", { email: "ana@test.ro", password: "parola123" });
        await screen.findByText("Pagina de proiecte");
        expect(localStorage.getItem("token")).toBe("tok-123");
    });

    it("parolă greșită → mesaj de eroare, rămâne pe login", async () => {
        vi.mocked(api.post).mockRejectedValue(httpError(401, "Email sau parolă incorectă."));
        renderLogin();

        await submit();

        expect(await screen.findByText("Email sau parolă incorectă.")).toBeInTheDocument();
        expect(screen.getByTestId("location")).toHaveTextContent("/login");
        expect(screen.queryByText("Cont inactiv")).not.toBeInTheDocument();
    });

    it("cont inactiv → pop-up cu numărul administratorului, ca text simplu", async () => {
        vi.mocked(api.post).mockRejectedValue(httpError(403, { code: "account_inactive" }));
        renderLogin();

        await submit();

        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText("Cont inactiv")).toBeInTheDocument();
        expect(within(dialog).getByText(/Contactează administratorul la \+4038940/)).toBeInTheDocument();
        expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
        expect(localStorage.getItem("token")).toBeNull();
    });

    it("pop-up-ul de cont inactiv se închide cu „Am înțeles”", async () => {
        vi.mocked(api.post).mockRejectedValue(httpError(403, { code: "account_inactive" }));
        renderLogin();
        await submit();

        await userEvent.click(await screen.findByRole("button", { name: "Am înțeles" }));

        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    });

    it("redirect din sesiune / Google cu ?error=account_inactive → pop-up deschis direct", async () => {
        renderLogin("/login?error=account_inactive");

        expect(await screen.findByRole("alertdialog")).toHaveTextContent("Cont inactiv");
    });

    it("Google refuzat (?error=google_failed) → mesaj de eroare", async () => {
        renderLogin("/login?error=google_failed");

        expect(await screen.findByText(/Autentificarea cu Google nu a reușit/)).toBeInTheDocument();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("eroare de rețea (fără răspuns) → mesaj generic, fără pop-up", async () => {
        vi.mocked(api.post).mockRejectedValue(new Error("Network Error"));
        renderLogin();

        await submit();

        expect(await screen.findByText("Email sau parolă incorectă.")).toBeInTheDocument();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
});
