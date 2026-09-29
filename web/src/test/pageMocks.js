// Mock-uri comune pentru paginile cu layout (Sidebar/Topbar) și context-uri.
// Se folosesc cu: vi.mock("../components/ui/Sidebar.jsx", () => sidebarMock) etc.
import { vi } from "vitest";

export const sidebarMock = { Sidebar: () => null };
export const topbarMock = { Topbar: () => null };
export const themeMock = { useTheme: () => ({ dark: false, toggle() {} }) };
export const projectsMock = { useProjects: () => ({ projects: [], setProjects() {}, refreshProjects: vi.fn(() => Promise.resolve()) }) };
export const sidebarStateMock = { useSidebarState: () => ({ sidebarOpen: false, setSidebarOpen() {} }) };
export const favoritesMock = {
    useFavorites: () => ({ favorites: [], isFavorite: () => false, toggleFavorite() {}, removeFavorite() {}, updateFavorite() {} }),
};
