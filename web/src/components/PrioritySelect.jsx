import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// prioritatea e trimisă la backend ca număr (0 = Low, 1 = Medium, 2 = High)
const PRIORITIES = [
    { value: 0, label: "Low",    dot: "bg-sky-400" },
    { value: 1, label: "Medium", dot: "bg-amber-400" },
    { value: 2, label: "High",   dot: "bg-rose-400" },
];

function PriorityLabel({ priority }) {
    return (
        <span className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${priority.dot}`} />
            {priority.label}
        </span>
    );
}

export default function PrioritySelect({ value, onChange, dark }) {
    const selected = PRIORITIES.find(p => p.value === value) ?? PRIORITIES[1];

    return (
        <Select value={selected.value} onValueChange={v => onChange(v)} items={PRIORITIES}>
            <SelectTrigger aria-label="Prioritate"
                className={`w-full h-9! cursor-pointer ${dark
                    ? "bg-[#2d2b52]! border-[#3a3768] text-white hover:bg-[#3a3768]! focus-visible:border-[#524E91]"
                    : "bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100 focus-visible:border-[#524E91]"}`}>
                <SelectValue>{() => <PriorityLabel priority={selected} />}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}
                className={dark ? "bg-[#1e1c3a] text-white ring-[#3a3768]" : "bg-white text-gray-900"}>
                {PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value}
                        className={`cursor-pointer py-1.5 ${dark ? "focus:bg-[#524E91]/30 focus:text-white" : "focus:bg-[#524E91]/10"}`}>
                        <PriorityLabel priority={p} />
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
