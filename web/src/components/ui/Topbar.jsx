import { Link } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useSidebarState } from "../../context/SidebarContext.jsx";

export function Topbar({ breadcrumbs = [], actions }) {
    const { dark } = useTheme();
    const { sidebarOpen, setSidebarOpen } = useSidebarState();

    return (
        <header className={`h-14 backdrop-blur-sm border-b shrink-0 relative flex items-center px-4 z-20
            ${dark ? "bg-[#1e1c3a]/90 border-[#3a3768]" : "bg-white/90 border-gray-200"}`}>

            <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Logo — fade+slide in/out sincronizat cu sidebar-ul (doar mobil; pe desktop bara minimală are propriul buton) */}
                <div className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden shrink-0
                    ${sidebarOpen ? "w-0 opacity-0" : "w-8 opacity-100 mr-1"}`}>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        title="Deschide sidebar"
                        className="flex items-center justify-center w-8 h-8 rounded-lg transition-transform duration-200 hover:scale-105 cursor-pointer"
                        style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                        </svg>
                    </button>
                </div>

                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 min-w-0">
                    {/* Desktop: toate */}
                    <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                        {breadcrumbs.map((crumb, i) => {
                            const isLast = i === breadcrumbs.length - 1;
                            return (
                                <span key={i} className="flex items-center gap-1.5 min-w-0">
                                    {i > 0 && (
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 shrink-0 ${dark ? "text-[#3a3768]" : "text-gray-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                    )}
                                    {isLast ? (
                                        <span className={`text-sm font-semibold truncate max-w-50 ${dark ? "text-white" : "text-gray-900"}`}>
                                            {crumb.label}
                                        </span>
                                    ) : (
                                        <Link to={crumb.to} className={`text-sm transition-colors duration-150 truncate max-w-24 ${dark ? "text-[#9b98c8] hover:text-white" : "text-gray-500 hover:text-[#524E91]"}`}>
                                            {crumb.label}
                                        </Link>
                                    )}
                                </span>
                            );
                        })}
                    </div>
                    {/* Mobile: back arrow + titlu curent */}
                    <div className="flex sm:hidden items-center gap-2 min-w-0">
                        {breadcrumbs.length > 1 && (
                            <Link
                                to={breadcrumbs[breadcrumbs.length - 2].to ?? "#"}
                                className={`shrink-0 p-1 rounded transition-colors ${dark ? "text-[#9b98c8] hover:text-white" : "text-gray-400 hover:text-[#524E91]"}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                            </Link>
                        )}
                        <span className={`text-sm font-semibold truncate max-w-45 ${dark ? "text-white" : "text-gray-900"}`}>
                            {breadcrumbs[breadcrumbs.length - 1]?.label}
                        </span>
                    </div>
                </nav>

                {actions && <div className="shrink-0 ml-1">{actions}</div>}
            </div>
        </header>
    );
}
