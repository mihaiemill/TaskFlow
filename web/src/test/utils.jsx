import { vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

// Afișează URL-ul curent, ca testele să poată verifica navigarea
export function LocationDisplay() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname + location.search}</div>;
}

// Randează o pagină la `url`, cu rutele extra date (ex. destinația unui link)
export function renderAt(url, path, element, extraRoutes = []) {
    return render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route path={path} element={element} />
                {extraRoutes.map(r => <Route key={r.path} path={r.path} element={r.element} />)}
            </Routes>
            <LocationDisplay />
        </MemoryRouter>
    );
}

// fetch simulat: `routes` = { "GET /api/x": body | (init) => body | { status, body } }
// Întoarce mock-ul, ca testul să verifice ce apeluri s-au făcut.
export function mockFetch(routes) {
    const fn = vi.fn(async (url, init = {}) => {
        const method = (init.method ?? "GET").toUpperCase();
        const path = String(url).split("?")[0];
        const handler = routes[`${method} ${path}`];
        if (handler === undefined) return new Response(JSON.stringify({ error: `nesimulat: ${method} ${path}` }), { status: 404 });
        let result = typeof handler === "function" ? handler(init) : handler;
        if (!(result && typeof result === "object" && "status" in result && "body" in result)) result = { status: 200, body: result };
        return new Response(result.body === null ? null : JSON.stringify(result.body), {
            status: result.status,
            headers: { "Content-Type": "application/json" },
        });
    });
    vi.stubGlobal("fetch", fn);
    return fn;
}

export const callsTo = (fetchMock, method, path) =>
    fetchMock.mock.calls.filter(([url, init = {}]) =>
        String(url).split("?")[0] === path && (init.method ?? "GET").toUpperCase() === method);

// JWT nesemnat, suficient pentru jwtDecode din frontend
export function fakeToken(payload) {
    const b64 = obj => btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.x`;
}
