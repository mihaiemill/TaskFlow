import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import api from "../api/axiosInstance.js";
import { ThemeToggle } from "../components/ui/ThemeToggle.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card.jsx";

export default function LoginPage() {
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const { dark } = useTheme();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const { data } = await api.post("/auth/login", form);
            login(data.token);
            navigate("/projects");
        } catch {
            setError("Email sau parolă incorectă.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const { data } = await api.get("/auth/google");
            window.location.href = data.url;
        } catch {
            setError("Nu s-a putut iniția autentificarea cu Google.");
        }
    };

    return (
        <div
            className={`min-h-screen flex flex-col relative
                ${dark ? "bg-[#13112a]" : "bg-linear-to-br from-[#f0efff] via-white to-[#e8fafa]"}`}
            style={dark ? { background: "linear-gradient(135deg, #13112a 0%, #1e1c3a 50%, #0f2a2a 100%)" } : {}}
        >
            {/* Background blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
                     style={{ background: "#524E91", filter: "blur(80px)" }} />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-20"
                     style={{ background: "#5AC4C2", filter: "blur(80px)" }} />
            </div>

            {/* Theme toggle */}
            <div className="fixed top-4 right-4 z-50" style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}>
                <ThemeToggle />
            </div>

            {/* Top spacer */}
            <div className="flex-1 min-h-4 md:min-h-8" />

            {/* Centered content */}
            <div className="w-full max-w-md mx-auto px-5 md:px-4 relative z-10">
                {/* Logo */}
                <div className="text-center mb-5 md:mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl mb-3 md:mb-4 shadow-lg"
                         style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 md:w-8 md:h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 11l3 3L22 4" />
                            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                        </svg>
                    </div>
                    <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${dark ? "text-white" : "text-gray-900"}`}>TaskFlow</h1>
                    <p className={`mt-1 text-sm ${dark ? "text-[#9b98c8]" : "text-gray-500"}`}>Gestionează-ți proiectele eficient</p>
                </div>

                {/* Card */}
                <Card className={`shadow-2xl backdrop-blur-sm ${dark ? "border-[#3a3768] bg-[#1e1c3a]/90" : "border-gray-200 bg-white"}`}>
                    <CardHeader className="pb-3 md:pb-4 px-5 md:px-6">
                        <CardTitle className={`text-xl ${dark ? "text-white" : "text-gray-900"}`}>Autentificare</CardTitle>
                        <CardDescription className={dark ? "text-[#9b98c8]" : "text-gray-500"}>
                            Introdu credențialele pentru a continua
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-5 md:px-6 pb-5 md:pb-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:gap-5">
                            <div className="space-y-1.5 md:space-y-2">
                                <Label htmlFor="email" className={dark ? "text-[#c4c2e8]" : "text-gray-700"}>Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    inputMode="email"
                                    placeholder="email@exemplu.com"
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    className={`h-11 ${dark ? "bg-[#2d2b52] border-[#3a3768] text-white placeholder:text-[#6b68a0] focus:border-[#524E91]" : "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#524E91]"}`}
                                />
                            </div>
                            <div className="space-y-1.5 md:space-y-2">
                                <Label htmlFor="password" className={dark ? "text-[#c4c2e8]" : "text-gray-700"}>Parolă</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    className={`h-11 ${dark ? "bg-[#2d2b52] border-[#3a3768] text-white placeholder:text-[#6b68a0] focus:border-[#524E91]" : "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#524E91]"}`}
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 text-white font-semibold transition-all duration-200 mt-1 hover:opacity-90 active:scale-[0.98]"
                                style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}
                            >
                                {loading ? "Se conectează..." : "Intră în cont"}
                            </Button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className={`w-full border-t ${dark ? "border-[#3a3768]" : "border-gray-200"}`} />
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className={`px-2 ${dark ? "bg-[#1e1c3a] text-[#6b68a0]" : "bg-white text-gray-400"}`}>sau</span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                onClick={handleGoogleLogin}
                                className={`w-full h-11 font-semibold flex items-center justify-center gap-3 active:scale-[0.98] ${dark ? "bg-[#2d2b52] border border-[#3a3768] text-white hover:bg-[#3a3768]" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                                Continuă cu Google
                            </Button>

                            <Link to="/register">
                                <Button type="button" variant="outline" className={`w-full h-11 active:scale-[0.98] ${dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#524E91]/20 hover:text-white hover:border-[#524E91]" : "border-gray-300 text-gray-600 hover:border-[#524E91] hover:text-[#524E91]"}`}>
                                    Creează cont nou
                                </Button>
                            </Link>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom spacer */}
            <div className="flex-1 min-h-4 md:min-h-8" />
        </div>
    );
}
