import * as React from "react";

import { CSSProperties } from "react";
import clsx from "clsx";

export type ButtonType = "primary" | "danger" | null;

export function IconButton(props: {
  onClick?: () => void;
  icon?: JSX.Element;
  type?: ButtonType;
  text?: string;
  bordered?: boolean;
  shadow?: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
  tabIndex?: number;
  autoFocus?: boolean;
  style?: CSSProperties;
  aria?: string;
}) {
  return (
    <button
      className={clsx(
        "clickable",
        "flex cursor-pointer items-center justify-center overflow-hidden rounded-[10px] border-none bg-white p-2.5 text-black outline-none [transition:all_0.3s_ease] select-none hover:border-primary focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 max-[600px]:p-4",
        {
          "[border:var(--border-in-light)]": props.bordered,
          "shadow-card": props.shadow,
          "bg-primary text-[white] [&_path]:fill-[white]!":
            props.type === "primary",
          "border-[rgba(255,0,0,0.5)] bg-[rgba(255,0,0,0.05)] text-[rgba(255,0,0,0.8)] hover:border-[red] hover:bg-[rgba(255,0,0,0.1)] [&_path]:fill-[red]!":
            props.type === "danger",
        },
        props.className,
      )}
      onClick={props.onClick}
      title={props.title}
      disabled={props.disabled}
      role="button"
      tabIndex={props.tabIndex}
      autoFocus={props.autoFocus}
      style={props.style}
      aria-label={props.aria}
    >
      {props.icon && (
        <div
          aria-label={props.text || props.title}
          className={clsx("flex h-4 w-4 items-center justify-center", {
            "no-dark": props.type === "primary",
          })}
        >
          {props.icon}
        </div>
      )}

      {props.text && (
        <div
          aria-label={props.text || props.title}
          className="overflow-hidden text-xs text-ellipsis whitespace-nowrap not-first:ml-1.25"
        >
          {props.text}
        </div>
      )}
    </button>
  );
}
