import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function GoogleCallbackPage() {
    const navigate = useNavigate();
    const { login, isAuth } = useAuth();
    const [tokenProcessed, setTokenProcessed] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (token) {
            localStorage.setItem("token", token);
            login(token);
            setTokenProcessed(true);
        } else {
            navigate("/login", { replace: true });
        }
    }, []);

    useEffect(() => {
        if (tokenProcessed && isAuth) {
            navigate("/projects", { replace: true });
        }
    }, [isAuth, tokenProcessed]);

    return (
        <div className="flex items-center justify-center h-screen">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Se autentifică...</p>
            </div>
        </div>
    );
}