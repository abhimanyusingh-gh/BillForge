/**
 * @jest-environment jsdom
 */
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { Combobox, type ComboboxOption } from "@/components/ds/Combobox";

interface FruitId {
  readonly raw: string;
}

const FRUITS: ReadonlyArray<ComboboxOption<FruitId>> = [
  { value: { raw: "apple" }, label: "Apple", description: "Pome" },
  { value: { raw: "banana" }, label: "Banana", description: "Berry" },
  { value: { raw: "cherry" }, label: "Cherry", description: "Drupe" },
  { value: { raw: "durian" }, label: "Durian", disabled: true }
];

function fruitKey(value: FruitId): string {
  return value.raw;
}

function Harness(props: {
  initial?: FruitId | null;
  onChange?: (value: FruitId) => void;
  onClear?: () => void;
  loading?: boolean;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  options?: ReadonlyArray<ComboboxOption<FruitId>>;
  helperText?: string;
}) {
  const [value, setValue] = useState<FruitId | null>(props.initial ?? null);
  return (
    <Combobox
      label="Fruit"
      options={props.options ?? FRUITS}
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onChange?.(next);
      }}
      onClear={
        props.onClear
          ? () => {
              setValue(null);
              props.onClear?.();
            }
          : undefined
      }
      optionKey={fruitKey}
      loading={props.loading}
      error={props.error}
      disabled={props.disabled}
      searchable={props.searchable}
      helperText={props.helperText}
      placeholder="Pick a fruit"
    />
  );
}

describe("ds/Combobox", () => {
  it("renders label associated with the trigger button", () => {
    render(<Harness />);
    const trigger = screen.getByRole("combobox", { name: "Fruit" });
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("shows placeholder when no value selected and label of selected option otherwise", () => {
    const { unmount } = render(<Harness />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Pick a fruit");
    unmount();
    render(<Harness initial={{ raw: "banana" }} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Banana");
  });

  it("opens the listbox on click and fires onChange when an option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox", { name: "Fruit" });
    await user.click(within(listbox).getByRole("option", { name: /Apple/ }));
    expect(onChange).toHaveBeenCalledWith({ raw: "apple" });
    expect(screen.getByRole("combobox")).toHaveTextContent("Apple");
  });

  it("filters options by typed query", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("combobox"));
    const search = screen.getByRole("textbox");
    await user.type(search, "ban");
    expect(screen.getByRole("option", { name: /Banana/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Apple/ })).not.toBeInTheDocument();
  });

  it("supports keyboard navigation: ArrowDown highlights, Enter selects, Escape closes", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith({ raw: "banana" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders empty state when filter matches nothing", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("textbox"), "zzzz");
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("renders loading state and suppresses options", async () => {
    const user = userEvent.setup();
    render(<Harness loading />);
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("disables trigger when disabled prop set; clicking does not open", async () => {
    const user = userEvent.setup();
    render(<Harness disabled />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("ignores clicks on disabled options and does not fire onChange", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("combobox"));
    const durian = screen.getByRole("option", { name: /Durian/ });
    await user.click(durian);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("renders error message with role=alert and wires aria-invalid + aria-describedby", () => {
    render(<Harness error="Required field" />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    const errorEl = screen.getByRole("alert");
    expect(errorEl).toHaveTextContent("Required field");
    expect(trigger.getAttribute("aria-describedby")).toBe(errorEl.id);
  });

  it("renders helperText and wires aria-describedby when no error", () => {
    render(<Harness helperText="Pick the closest match" />);
    const trigger = screen.getByRole("combobox");
    const helper = screen.getByText("Pick the closest match");
    expect(trigger.getAttribute("aria-describedby")).toBe(helper.id);
  });

  it("offers a Clear option when onClear + value are present and invokes it", async () => {
    const user = userEvent.setup();
    const onClear = jest.fn();
    render(<Harness initial={{ raw: "apple" }} onClear={onClear} />);
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toHaveTextContent("Pick a fruit");
  });

  it("non-searchable mode hides search input but still lists options", async () => {
    const user = userEvent.setup();
    render(<Harness searchable={false} />);
    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(FRUITS.length);
  });

  it("renders empty option list with empty text when options array is empty", async () => {
    const user = userEvent.setup();
    render(<Harness options={[]} />);
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });
});
