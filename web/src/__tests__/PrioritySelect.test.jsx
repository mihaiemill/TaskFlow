import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PrioritySelect from "../components/PrioritySelect.jsx";

describe("PrioritySelect (shadcn)", () => {
    it("afișează prioritatea curentă", () => {
        render(<PrioritySelect value={2} onChange={() => {}} />);
        expect(screen.getByRole("combobox", { name: "Prioritate" })).toHaveTextContent("High");
    });

    it("alegerea unei opțiuni trimite valoarea numerică", async () => {
        const onChange = vi.fn();
        render(<PrioritySelect value={1} onChange={onChange} />);

        await userEvent.click(screen.getByRole("combobox", { name: "Prioritate" }));
        await userEvent.click(await screen.findByRole("option", { name: "Low" }));

        expect(onChange).toHaveBeenCalledWith(0);
    });
});
