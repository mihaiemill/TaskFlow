// Navigare cu reload complet (ieșire din sesiune). Separată într-un modul ca testele să o poată înlocui —
// în jsdom `window.location` nu poate fi suprascris.
export function redirectTo(url) {
    window.location.href = url;
}
