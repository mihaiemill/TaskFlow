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
import { AvatarPicker } from "../components/UserAvatar.jsx";

export default function RegisterPage() {
    const [form, setForm] = useState({ email: "", password: "", fullName: "", avatar: null });
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
            const { data } = await api.post("/auth/register", form);
            login(data.token);
            navigate("/projects");
        } catch {
            setError("Email deja folosit sau date invalide.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className={`min-h-screen flex flex-col relative
                ${dark ? "" : "bg-linear-to-br from-[#f0efff] via-white to-[#e8fafa]"}`}
            style={dark ? { background: "linear-gradient(135deg, #13112a 0%, #1e1c3a 50%, #0f2a2a 100%)" } : {}}
        >
            {/* Background blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
                     style={{ background: "#524E91", filter: "blur(80px)" }} />
                <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-20"
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
                            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 00-3-3.87" />
                            <path d="M16 3.13a4 4 0 010 7.75" />
                        </svg>
                    </div>
                    <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${dark ? "text-white" : "text-gray-900"}`}>TaskFlow</h1>
                    <p className={`mt-1 text-sm ${dark ? "text-[#9b98c8]" : "text-gray-500"}`}>Creează-ți contul gratuit</p>
                </div>

                {/* Card */}
                <Card className={`shadow-2xl backdrop-blur-sm ${dark ? "border-[#3a3768] bg-[#1e1c3a]/90" : "border-gray-200 bg-white"}`}>
                    <CardHeader className="pb-3 md:pb-4 px-5 md:px-6">
                        <CardTitle className={`text-xl ${dark ? "text-white" : "text-gray-900"}`}>Înregistrare</CardTitle>
                        <CardDescription className={dark ? "text-[#9b98c8]" : "text-gray-500"}>
                            Completează datele pentru a începe
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-5 md:px-6 pb-5 md:pb-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 md:gap-5">
                            <div className="space-y-1.5 md:space-y-2">
                                <Label htmlFor="fullName" className={dark ? "text-[#c4c2e8]" : "text-gray-700"}>Nume complet</Label>
                                <Input
                                    id="fullName"
                                    type="text"
                                    autoComplete="name"
                                    placeholder="Ion Popescu"
                                    value={form.fullName}
                                    onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                                    className={`h-11 ${dark ? "bg-[#2d2b52] border-[#3a3768] text-white placeholder:text-[#6b68a0] focus:border-[#524E91]" : "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#524E91]"}`}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className={dark ? "text-[#c4c2e8]" : "text-gray-700"}>
                                    Avatar <span className={`font-normal ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>(opțional)</span>
                                </Label>
                                <AvatarPicker value={form.avatar} onChange={avatar => setForm(f => ({ ...f, avatar }))}
                                    name={form.fullName} dark={dark} allowNone />
                            </div>
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
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    className={`h-11 ${dark ? "bg-[#2d2b52] border-[#3a3768] text-white placeholder:text-[#6b68a0] focus:border-[#524E91]" : "bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#524E91]"}`}
                                />
                                <p className={`text-xs ${dark ? "text-[#6b68a0]" : "text-gray-400"}`}>Minim 6 caractere</p>
                            </div>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 text-white font-semibold transition-all duration-200 mt-1 hover:opacity-90 active:scale-[0.98]"
                                style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}
                            >
                                {loading ? "Se creează contul..." : "Creează cont"}
                            </Button>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className={`w-full border-t ${dark ? "border-[#3a3768]" : "border-gray-200"}`} />
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className={`px-2 ${dark ? "bg-[#1e1c3a] text-[#6b68a0]" : "bg-white text-gray-400"}`}>sau</span>
                                </div>
                            </div>
                            <Link to="/login">
                                <Button type="button" variant="outline" className={`w-full h-11 active:scale-[0.98] ${dark ? "border-[#3a3768] text-[#9b98c8] hover:bg-[#524E91]/20 hover:text-white hover:border-[#524E91]" : "border-gray-300 text-gray-600 hover:border-[#524E91] hover:text-[#524E91]"}`}>
                                    Am deja un cont
                                </Button>
                            </Link>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom spacer */}
            <div className="flex-[1.4] min-h-10 md:flex-1 md:min-h-8" />
        </div>
    );
}
