import axios from "axios";
import { redirectTo } from "../lib/navigation.js";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 la /auth/login = credențiale greșite — o tratează LoginPage (mesaj/pop-up), fără reload
    const isLoginCall = err.config?.url === "/auth/login";
    if (err.response?.status === 401 && !isLoginCall) {
      localStorage.removeItem("token");
      // contul a fost dezactivat în timpul sesiunii → pagina de login afișează alerta „Cont inactiv”
      redirectTo(err.response.data?.code === "account_inactive"
        ? "/login?error=account_inactive"
        : "/login");
    }
    return Promise.reject(err);
  }
);

export default api;