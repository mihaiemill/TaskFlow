import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";

vi.mock("../lib/navigation.js", () => ({ redirectTo: vi.fn() }));

import { redirectTo } from "../lib/navigation.js";
import api from "../api/axiosInstance.js";
import { AuthProvider } from "../context/AuthContext.jsx";
import { mockFetch } from "../test/utils.jsx";

// Adapter axios simulat: fiecare request primește răspunsul dat (fără rețea)
function respondWith(status, data) {
    api.defaults.adapter = async config => {
        const response = { status, data, headers: {}, config, statusText: "" };
        if (status >= 200 && status < 300) return response;
        throw new AxiosError("eroare simulată", "ERR_BAD_RESPONSE", config, null, response);
    };
}

beforeEach(() => { vi.mocked(redirectTo).mockClear(); });

describe("interceptor axios", () => {
    it("adaugă token-ul din localStorage în header-ul Authorization", async () => {
        localStorage.setItem("token", "abc");
        let sentHeader;
        api.defaults.adapter = async config => {
            sentHeader = config.headers.Authorization;
            return { status: 200, data: {}, headers: {}, config };
        };
        await api.get("/projects");
        expect(sentHeader).toBe("Bearer abc");
    });

    it("401 obișnuit → iese din cont și merge la /login", async () => {
        localStorage.setItem("token", "abc");
        respondWith(401, {});
        await expect(api.get("/projects")).rejects.toBeTruthy();
        expect(localStorage.getItem("token")).toBeNull();
        expect(redirectTo).toHaveBeenCalledWith("/login");
    });

    it("401 cu cont dezactivat în sesiune → /login cu alerta de cont inactiv", async () => {
        localStorage.setItem("token", "abc");
        respondWith(401, { code: "account_inactive" });
        await expect(api.get("/projects")).rejects.toBeTruthy();
        expect(redirectTo).toHaveBeenCalledWith("/login?error=account_inactive");
    });

    it("401 la /auth/login (parolă greșită) → fără reload, eroarea ajunge la pagină", async () => {
        respondWith(401, "Email sau parolă incorectă.");
        await expect(api.post("/auth/login", {})).rejects.toMatchObject({ response: { status: 401 } });
        expect(redirectTo).not.toHaveBeenCalled();
    });

    it("403 (ex. cont inactiv la login, permisiune lipsă) → nu scoate din cont", async () => {
        localStorage.setItem("token", "abc");
        respondWith(403, { code: "account_inactive" });
        await expect(api.post("/auth/login", {})).rejects.toBeTruthy();
        expect(localStorage.getItem("token")).toBe("abc");
        expect(redirectTo).not.toHaveBeenCalled();
    });
});

describe("AuthContext — verificarea sesiunii la încărcare", () => {
    it("cont dezactivat → token șters și redirect cu alerta de cont inactiv", async () => {
        localStorage.setItem("token", "abc");
        mockFetch({ "GET /api/auth/me": { status: 401, body: { code: "account_inactive" } } });

        render(<AuthProvider><div /></AuthProvider>);

        await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/login?error=account_inactive"));
        expect(localStorage.getItem("token")).toBeNull();
    });

    it("token invalid (utilizator șters) → redirect simplu la /login", async () => {
        localStorage.setItem("token", "abc");
        mockFetch({ "GET /api/auth/me": { status: 401, body: {} } });

        render(<AuthProvider><div /></AuthProvider>);

        await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/login"));
    });

    it("sesiune validă → rămâne logat", async () => {
        localStorage.setItem("token", "abc");
        const fetchMock = mockFetch({ "GET /api/auth/me": { hasPassword: true, avatar: "fox" } });

        render(<AuthProvider><div /></AuthProvider>);

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(redirectTo).not.toHaveBeenCalled();
        expect(localStorage.getItem("token")).toBe("abc");
    });

    it("fără token → nu face nicio cerere", () => {
        const fetchMock = mockFetch({});
        render(<AuthProvider><div /></AuthProvider>);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
