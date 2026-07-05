import * as SelectPrimitive from "@radix-ui/react-select";
import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const emptyValue = "__english_learning_empty_value__";

type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type SelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "children" | "defaultValue" | "multiple" | "onBlur" | "onChange" | "onFocus" | "size" | "value"
> & {
  children: React.ReactNode;
  value?: string | number | null;
  defaultValue?: string | number | null;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
};

function normalizeValue(value: string | number | null | undefined) {
  return value == null || value === "" ? emptyValue : String(value);
}

function denormalizeValue(value: string) {
  return value === emptyValue ? "" : value;
}

function optionValue(option: React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>) {
  const value = option.props.value;
  if (value != null) {
    return String(value);
  }

  return typeof option.props.children === "string" ? option.props.children : "";
}

function extractOptions(children: React.ReactNode) {
  const options: SelectOption[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child)) {
      return;
    }

    if (child.type !== "option") {
      return;
    }

    options.push({
      value: optionValue(child),
      label: child.props.children,
      disabled: child.props.disabled
    });
  });

  return options;
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      children,
      className,
      defaultValue,
      disabled,
      id,
      name,
      onBlur,
      onChange,
      onFocus,
      required,
      value,
      ...props
    },
    ref
  ) => {
    const options = extractOptions(children);
    const normalizedValue = value === undefined ? undefined : normalizeValue(value);
    const normalizedDefaultValue = defaultValue === undefined ? undefined : normalizeValue(defaultValue);

    function emitChange(nextValue: string) {
      const rawValue = denormalizeValue(nextValue);
      const event = {
        target: { value: rawValue },
        currentTarget: { value: rawValue }
      } as React.ChangeEvent<HTMLSelectElement>;
      onChange?.(event);
    }

    return (
      <SelectPrimitive.Root
        value={normalizedValue}
        defaultValue={normalizedDefaultValue}
        disabled={disabled}
        name={name}
        required={required}
        onValueChange={emitChange}
      >
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          aria-label={props["aria-label"]}
          onBlur={onBlur}
          onFocus={onFocus}
          className={cn(
            "flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-[16px] border border-[color:var(--hairline)] bg-white/72 px-4 text-left text-sm font-bold text-[var(--text)] outline-none transition-[border-color,background-color,box-shadow,color] duration-300 ease-[var(--ease-soft)] hover:border-[color:var(--hairline-strong)] hover:bg-white focus:border-[color:var(--action)] focus:bg-white focus:ring-4 focus:ring-[color:var(--action-soft)] disabled:pointer-events-none disabled:opacity-60 data-[placeholder]:text-[var(--muted)]",
            className
          )}
        >
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={8}
            collisionPadding={16}
            className="z-[80] max-h-[min(18rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[18px] border border-[color:var(--hairline)] bg-[var(--surface-2)] p-1 text-[var(--text)] shadow-[var(--shadow-lift)]"
          >
            <SelectPrimitive.Viewport className="max-h-[inherit] overflow-y-auto p-1">
              {options.map((option) => {
                const itemValue = normalizeValue(option.value);

                return (
                  <SelectPrimitive.Item
                    key={itemValue}
                    value={itemValue}
                    disabled={option.disabled}
                    className="relative flex min-h-10 cursor-pointer select-none items-center rounded-[14px] py-2 pl-9 pr-3 text-sm font-extrabold outline-none transition-colors duration-200 ease-[var(--ease-soft)] data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-[var(--action-soft)] data-[highlighted]:text-[var(--action-strong)]"
                  >
                    <SelectPrimitive.ItemIndicator className="absolute left-3 inline-grid h-4 w-4 place-items-center text-[var(--action-strong)]">
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                );
              })}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  }
);
Select.displayName = "Select";
