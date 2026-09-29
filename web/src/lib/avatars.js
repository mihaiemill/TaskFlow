export const AVATARS = [
    { key: "fox",       emoji: "🦊", label: "Vulpe",     bg: "#fed7aa" },
    { key: "panda",     emoji: "🐼", label: "Panda",     bg: "#e5e7eb" },
    { key: "octopus",   emoji: "🐙", label: "Caracatiță", bg: "#fbcfe8" },
    { key: "owl",       emoji: "🦉", label: "Bufniță",   bg: "#e7d8c9" },
    { key: "cat",       emoji: "🐱", label: "Pisică",    bg: "#fde68a" },
    { key: "dog",       emoji: "🐶", label: "Câine",     bg: "#f5deb3" },
    { key: "lion",      emoji: "🦁", label: "Leu",       bg: "#fcd34d" },
    { key: "tiger",     emoji: "🐯", label: "Tigru",     bg: "#fdba74" },
    { key: "koala",     emoji: "🐨", label: "Koala",     bg: "#cbd5e1" },
    { key: "frog",      emoji: "🐸", label: "Broască",   bg: "#bbf7d0" },
    { key: "penguin",   emoji: "🐧", label: "Pinguin",   bg: "#bae6fd" },
    { key: "unicorn",   emoji: "🦄", label: "Unicorn",   bg: "#e9d5ff" },
    { key: "bear",      emoji: "🐻", label: "Urs",       bg: "#d6bfa8" },
    { key: "rabbit",    emoji: "🐰", label: "Iepure",    bg: "#fce7f3" },
    { key: "monkey",    emoji: "🐵", label: "Maimuță",   bg: "#e8cfb0" },
    { key: "whale",     emoji: "🐳", label: "Balenă",    bg: "#a5f3fc" },
    { key: "turtle",    emoji: "🐢", label: "Țestoasă",  bg: "#d9f99d" },
    { key: "bee",       emoji: "🐝", label: "Albină",    bg: "#fef08a" },
    { key: "butterfly", emoji: "🦋", label: "Fluture",   bg: "#bfdbfe" },
    { key: "dragon",    emoji: "🐲", label: "Dragon",    bg: "#a7f3d0" },
];

const BY_KEY = Object.fromEntries(AVATARS.map(a => [a.key, a]));

export const getAvatar = key => (key && BY_KEY[key]) || null;
