import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { AVATARS, getAvatar } from "../lib/avatars.js";
import { cn } from "cn";

export function UserAvatar({ avatar, name, className, title }) {
    const a = getAvatar(avatar);
    return (
        <Avatar className={cn("after:hidden", className)} title={title ?? a?.label ?? name}>
            {a ? (
                <AvatarFallback className="leading-none" style={{ background: a.bg }}>
                    <span aria-hidden="true">{a.emoji}</span>
                </AvatarFallback>
            ) : (
                <AvatarFallback className="text-white text-[0.75em] font-bold"
                    style={{ background: "linear-gradient(135deg, #524E91, #5AC4C2)" }}>
                    {name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
            )}
        </Avatar>
    );
}

export function AvatarPicker({ value, onChange, name, dark, allowNone = false, className }) {
    const ring = selected => selected
        ? "ring-2 ring-[#524E91] ring-offset-2 " + (dark ? "ring-offset-[#1e1c3a]" : "ring-offset-white")
        : "hover:scale-110";

    return (
        <div role="radiogroup" aria-label="Alege un avatar" className={cn("grid grid-cols-5 sm:grid-cols-7 gap-2.5 justify-items-center", className)}>
            {allowNone && (
                <button type="button" role="radio" aria-checked={!value} title="Fără avatar (inițiala)"
                    onClick={() => onChange(null)}
                    className={`rounded-full transition-transform cursor-pointer ${ring(!value)}`}>
                    <UserAvatar name={name} className="size-10 text-base" title="Fără avatar (inițiala)" />
                </button>
            )}
            {AVATARS.map(a => (
                <button key={a.key} type="button" role="radio" aria-checked={value === a.key} title={a.label}
                    onClick={() => onChange(a.key)}
                    className={`rounded-full transition-transform cursor-pointer ${ring(value === a.key)}`}>
                    <UserAvatar avatar={a.key} className="size-10 text-xl" />
                </button>
            ))}
        </div>
    );
}
