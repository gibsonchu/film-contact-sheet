"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "outline", size = "md", className, ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-35 disabled:pointer-events-none";
  const sizes = size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-[12px]";
  const variants = {
    // bg-warm is already the extreme of the neutral scale in each theme, so
    // there's no further step to push it to as a hover color — a fade is
    // the one affordance that reads as "clickable" in both directions.
    primary: "bg-warm text-noir transition-opacity hover:opacity-80",
    ghost: "text-smoke hover:text-warm",
    outline: "border border-[var(--line)] text-bone hover:border-warm hover:text-warm",
    danger: "border border-darkroom/70 text-darkroom hover:bg-darkroom hover:text-white",
  }[variant];
  return <button className={cx(base, sizes, variants, className)} {...props} />;
}

export function IconButton({
  label,
  active,
  size = "sm",
  className,
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> & {
  label: string;
  active?: boolean;
  /** The dock wants a larger, more tactile target than the rail does; "lg" is
   *  the dock's primary row, sized to read as the main instrument, not a
   *  secondary control. */
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        "relative grid place-items-center transition-colors",
        size === "lg" ? "h-12 w-12 rounded-full" : size === "md" ? "h-9 w-9 rounded-full" : "h-7 w-7",
        active ? "bg-warm text-noir" : "text-smoke hover:text-warm",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="label block">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-[11px] leading-snug text-smoke/80">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "w-full border border-[var(--line)] bg-transparent px-2 py-1 text-[12px] text-warm placeholder:text-smoke/60 focus:border-warm focus:outline-none";

/**
 * A listbox that always opens downwards.
 *
 * A native <select> hands popup placement to the OS, which flips it above the
 * control when the chosen item is near the end of the list. This renders the
 * options into a portal pinned under the button and scrolls within whatever
 * room is left, so the direction never changes.
 */
export function Select<T extends string>({
  id,
  value,
  onChange,
  options,
  label,
}: {
  id?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const [box, setBox] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const place = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBox({
      left: r.left,
      top: r.bottom + 4,
      width: r.width,
      maxHeight: Math.max(140, window.innerHeight - r.bottom - 16),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onDown = (e: MouseEvent) => {
      if (
        !listRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onScrollOrResize = () => place();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, place]);

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setActive(Math.max(0, options.findIndex((o) => o.value === value)));
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    }
  }

  return (
    <>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => {
          setActive(Math.max(0, options.findIndex((o) => o.value === value)));
          setOpen((v) => !v);
        }}
        onKeyDown={onKeyDown}
        className={cx(inputClass, "flex items-center justify-between gap-2 text-left")}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0 text-smoke" aria-hidden="true">
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>

      {open && box
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              tabIndex={-1}
              onKeyDown={onKeyDown}
              // Marks this as floating content rendered outside its owner's DOM
              // subtree, so an ancestor panel with its own "click outside to
              // close" listener (e.g. a disclosure this select lives inside)
              // can recognise a click here as still inside, rather than racing
              // to close itself — and unmount this list — before the option's
              // own click can land.
              data-floating-content=""
              className="z-[60] overflow-y-auto border border-[var(--line)] bg-noir"
              style={{
                position: "fixed",
                left: box.left,
                top: box.top,
                width: box.width,
                maxHeight: box.maxHeight,
              }}
            >
              {options.map((o, i) => (
                <li key={o.value} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(i)}
                    className={cx(
                      "block w-full px-2 py-1 text-left text-[12px] transition-colors",
                      o.value === value ? "text-warm" : "text-smoke",
                      i === active && "bg-white/10 text-warm",
                    )}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * A section of the interface: a full-bleed hairline, a small caption, then
 * content. The negative margin lets the rule run to the edge of the column the
 * way a divider between panes does, rather than floating inside the padding.
 */
export function Panel({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("hair-t -mx-3 px-3 pt-2", className)}>
      {title ? <h2 className="label mb-2">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const first = ref.current?.querySelector<HTMLElement>(
      "button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:p-10">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative z-10 w-full border border-[var(--line)] bg-noir",
          wide ? "max-w-4xl" : "max-w-md",
        )}
      >
        <header className="hair-b flex items-start justify-between gap-6 px-3 py-2">
          <div>
            <h2 className="text-[13px] text-warm">{title}</h2>
            {description ? <p className="label mt-0.5 max-w-sm">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 grid h-5 w-5 place-items-center text-smoke hover:text-warm"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
              <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
        </header>
        <div className="px-3 py-3">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  /** The current template can't do anything with this setting — greyed out
   *  and inert rather than hidden, so it's clear the option exists. */
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={cx("flex items-start justify-between gap-3 py-[3px]", disabled && "opacity-40")}>
      <label htmlFor={id} className={cx("text-[12px] text-bone", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
        {label}
        {hint ? <span className="mt-0.5 block text-[11px] text-smoke/80">{hint}</span> : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "mt-[3px] grid h-3 w-3 shrink-0 place-items-center border transition-colors",
          disabled ? "cursor-not-allowed" : "",
          checked ? "border-warm bg-warm" : "border-[var(--line)] bg-transparent hover:border-smoke",
        )}
      >
        <svg viewBox="0 0 10 10" className={cx("h-2 w-2", checked ? "text-noir" : "text-transparent")} aria-hidden="true">
          <path d="M1.5 5.2 4 7.5 8.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap border border-[var(--line)]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title ?? o.label}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 whitespace-nowrap px-2 py-1 text-[11px] transition-colors",
            value === o.value ? "bg-warm text-noir" : "text-smoke hover:text-warm",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
