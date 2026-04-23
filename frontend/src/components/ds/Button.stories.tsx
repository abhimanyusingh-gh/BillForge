import type { ButtonProps } from "./Button";
import { Button } from "./Button";

type Story = { name: string; args: ButtonProps };

const meta = {
  title: "ds/Button",
  component: Button
} as const;
export default meta;

export const Primary: Story = {
  name: "Primary",
  args: { variant: "primary", children: "Save invoice" }
};

export const Secondary: Story = {
  name: "Secondary",
  args: { variant: "secondary", children: "Cancel" }
};

export const Destructive: Story = {
  name: "Destructive",
  args: { variant: "destructive", children: "Delete forever" }
};

export const Ghost: Story = {
  name: "Ghost",
  args: { variant: "ghost", children: "Dismiss" }
};

export const Small: Story = {
  name: "Small",
  args: { variant: "primary", size: "sm", children: "Apply" }
};

export const WithIcon: Story = {
  name: "With icon",
  args: { variant: "primary", icon: "download", children: "Export Tally XML" }
};

export const Loading: Story = {
  name: "Loading",
  args: { variant: "primary", loading: true, children: "Saving…" }
};

export const Disabled: Story = {
  name: "Disabled",
  args: { variant: "primary", disabled: true, children: "Submit" }
};
