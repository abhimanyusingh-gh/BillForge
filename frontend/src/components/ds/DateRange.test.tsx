/**
 * @jest-environment jsdom
 */
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import {
  DateRange,
  type DateRangePreset,
  type DateRangeValue
} from "@/components/ds/DateRange";

const PRESETS: ReadonlyArray<DateRangePreset> = [
  { id: "mtd", label: "Month to date", from: "2026-04-01", to: "2026-04-27" },
  { id: "last7", label: "Last 7 days", from: "2026-04-21", to: "2026-04-27" }
];

const QUARTERS: ReadonlyArray<DateRangePreset> = [
  { id: "fy26q1", label: "FY 25-26 · Q1", sub: "Apr–Jun 2025", from: "2025-04-01", to: "2025-06-30" },
  { id: "fy26q2", label: "FY 25-26 · Q2", sub: "Jul–Sep 2025", from: "2025-07-01", to: "2025-09-30" }
];

const YEARS: ReadonlyArray<DateRangePreset> = [
  { id: "fy25", label: "FY 25-26", from: "2025-04-01", to: "2026-03-31" },
  { id: "fy26", label: "FY 26-27", from: "2026-04-01", to: "2027-03-31" }
];

function Harness(props: {
  initial?: DateRangeValue;
  onChange?: (next: DateRangeValue) => void;
  presets?: ReadonlyArray<DateRangePreset>;
  quarterPresets?: ReadonlyArray<DateRangePreset>;
  yearPresets?: ReadonlyArray<DateRangePreset>;
  showCustom?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<DateRangeValue>(
    props.initial ?? { from: "2026-04-01", to: "2026-04-27", label: "Month to date", presetId: "mtd" }
  );
  return (
    <DateRange
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onChange?.(next);
      }}
      presets={props.presets ?? PRESETS}
      quarterPresets={props.quarterPresets ?? QUARTERS}
      yearPresets={props.yearPresets ?? YEARS}
      showCustom={props.showCustom ?? true}
      disabled={props.disabled}
      ariaLabel="Date range"
    />
  );
}

describe("ds/DateRange", () => {
  it("renders the trigger with the value label and the formatted range", () => {
    render(<Harness />);
    const trigger = screen.getByTestId("lb-daterange-trigger");
    expect(trigger).toHaveTextContent("Month to date");
    expect(screen.getByTestId("lb-daterange-trigger-range")).toHaveTextContent(
      /01 Apr 2026 → 27 Apr 2026/
    );
  });

  it("opens the popover on trigger click and shows tabs for each populated preset bucket", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByTestId("lb-daterange-popover")).toBeNull();
    await user.click(screen.getByTestId("lb-daterange-trigger"));
    expect(screen.getByTestId("lb-daterange-popover")).toBeInTheDocument();
    expect(screen.getByTestId("lb-daterange-tab-preset")).toBeInTheDocument();
    expect(screen.getByTestId("lb-daterange-tab-quarter")).toBeInTheDocument();
    expect(screen.getByTestId("lb-daterange-tab-year")).toBeInTheDocument();
    expect(screen.getByTestId("lb-daterange-tab-custom")).toBeInTheDocument();
  });

  it("commits a preset on click and closes the popover", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByTestId("lb-daterange-trigger"));
    await user.click(screen.getByTestId("lb-daterange-preset-last7"));
    expect(onChange).toHaveBeenCalledWith({
      from: "2026-04-21",
      to: "2026-04-27",
      presetId: "last7",
      label: "Last 7 days"
    });
    expect(screen.queryByTestId("lb-daterange-popover")).toBeNull();
  });

  it("commits an FY preset (Apr 1 → Mar 31 India fiscal year)", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByTestId("lb-daterange-trigger"));
    await user.click(screen.getByTestId("lb-daterange-tab-year"));
    await user.click(screen.getByTestId("lb-daterange-year-fy25"));
    expect(onChange).toHaveBeenCalledWith({
      from: "2025-04-01",
      to: "2026-03-31",
      presetId: "fy25",
      label: "FY 25-26"
    });
  });

  it("commits a quarter preset (Apr–Jun for Q1)", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByTestId("lb-daterange-trigger"));
    await user.click(screen.getByTestId("lb-daterange-tab-quarter"));
    await user.click(screen.getByTestId("lb-daterange-quarter-fy26q1"));
    expect(onChange).toHaveBeenCalledWith({
      from: "2025-04-01",
      to: "2025-06-30",
      presetId: "fy26q1",
      label: "FY 25-26 · Q1"
    });
  });

  it("commits a custom range from the date inputs", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByTestId("lb-daterange-trigger"));
    await user.click(screen.getByTestId("lb-daterange-tab-custom"));
    const fromInput = screen.getByTestId("lb-daterange-custom-from") as HTMLInputElement;
    const toInput = screen.getByTestId("lb-daterange-custom-to") as HTMLInputElement;
    await user.clear(fromInput);
    await user.type(fromInput, "2026-01-15");
    await user.clear(toInput);
    await user.type(toInput, "2026-02-20");
    await user.click(screen.getByTestId("lb-daterange-apply"));
    expect(onChange).toHaveBeenCalledWith({
      from: "2026-01-15",
      to: "2026-02-20",
      label: "Custom"
    });
  });

  it("disables Apply when the from date is after the to date", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId("lb-daterange-trigger"));
    await user.click(screen.getByTestId("lb-daterange-tab-custom"));
    const fromInput = screen.getByTestId("lb-daterange-custom-from") as HTMLInputElement;
    const toInput = screen.getByTestId("lb-daterange-custom-to") as HTMLInputElement;
    await user.clear(fromInput);
    await user.type(fromInput, "2026-05-10");
    await user.clear(toInput);
    await user.type(toInput, "2026-04-01");
    expect(screen.getByTestId("lb-daterange-apply")).toBeDisabled();
  });

  it("marks the active preset with data-active when value matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId("lb-daterange-trigger"));
    expect(screen.getByTestId("lb-daterange-preset-mtd")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("lb-daterange-preset-last7")).not.toHaveAttribute("data-active");
  });

  it("does not open the popover when disabled", async () => {
    const user = userEvent.setup();
    render(<Harness disabled />);
    await user.click(screen.getByTestId("lb-daterange-trigger"));
    expect(screen.queryByTestId("lb-daterange-popover")).toBeNull();
  });

  it("hides the custom tab when showCustom=false", async () => {
    const user = userEvent.setup();
    render(<Harness showCustom={false} />);
    await user.click(screen.getByTestId("lb-daterange-trigger"));
    expect(screen.queryByTestId("lb-daterange-tab-custom")).toBeNull();
  });

  it("closes the popover when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId("lb-daterange-trigger"));
    expect(screen.getByTestId("lb-daterange-popover")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("lb-daterange-popover")).toBeNull();
  });
});
