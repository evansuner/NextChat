import * as React from "react";
import clsx from "clsx";

interface InputRangeProps {
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  title?: string;
  value: number | string;
  className?: string;
  min: string;
  max: string;
  step: string;
  aria: string;
}

export function InputRange({
  onChange,
  title,
  value,
  className,
  min,
  max,
  step,
  aria,
}: InputRangeProps) {
  return (
    <div
      className={clsx(
        "flex max-w-[40%] justify-between rounded-[10px] px-2.5 py-1.25 text-xs [border:var(--border-in-light)] [&_input[type=range]]:max-w-[calc(100%-34px)]",
        className,
      )}
    >
      {title || value}
      <input
        aria-label={aria}
        type="range"
        title={title}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
      ></input>
    </div>
  );
}
