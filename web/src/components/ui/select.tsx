"use client";

import * as SelectPrimitive from "@radix-ui/react-select";

export type SelectOption = { value: string; label: string };

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  /** Accessible name when no visible <label> points at the trigger. */
  "aria-label"?: string;
  id?: string;
};

/**
 * House dropdown (shadcn pattern on Radix Select, restyled with tokens). The list is exactly as wide
 * as the trigger and capped to the space left in the viewport, so it never overflows a phone screen.
 * Rendered without a portal so it inherits the tokens of its room (e.g. the always-dark lightbox).
 */
export function Select({ value, onValueChange, options, id, ...aria }: Props) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={aria["aria-label"]}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border border-rule bg-surface px-3 text-left text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=open]:border-ink"
      >
        <span className="truncate">
          <SelectPrimitive.Value />
        </span>
        <SelectPrimitive.Icon asChild>
          <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-ink-2">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={4}
        collisionPadding={16}
        className="z-50 max-h-(--radix-select-content-available-height) w-(--radix-select-trigger-width) overflow-hidden rounded-sm border border-rule bg-surface text-sm text-ink shadow-lg"
      >
        <SelectPrimitive.Viewport className="p-1">
          {options.map((o) => (
            <SelectPrimitive.Item
              key={o.value}
              value={o.value}
              className="flex min-h-11 cursor-pointer items-center rounded-sm px-3 outline-none select-none data-highlighted:bg-surface-2 data-[state=checked]:text-accent"
            >
              <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Root>
  );
}
