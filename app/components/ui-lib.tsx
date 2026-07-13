/* eslint-disable @next/next/no-img-element */
import LoadingIcon from "../icons/three-dots.svg";
import CloseIcon from "../icons/close.svg";
import EyeIcon from "../icons/eye.svg";
import EyeOffIcon from "../icons/eye-off.svg";
import DownIcon from "../icons/down.svg";
import ConfirmIcon from "../icons/confirm.svg";
import CancelIcon from "../icons/cancel.svg";
import MaxIcon from "../icons/max.svg";
import MinIcon from "../icons/min.svg";

import Locale from "../locales";

import { createRoot } from "react-dom/client";
import React, {
  CSSProperties,
  HTMLProps,
  MouseEvent,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { IconButton } from "./button";
import { Avatar } from "./emoji";
import clsx from "clsx";

export function Popover(props: {
  children: JSX.Element;
  content: JSX.Element;
  open?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="relative z-[2]">
      {props.children}
      {props.open && (
        <div
          className="fixed left-0 top-0 h-screen w-screen bg-[rgba(0,0,0,0.3)] [backdrop-filter:blur(5px)]"
          onClick={props.onClose}
        ></div>
      )}
      {props.open && (
        <div className="absolute right-0 top-[calc(100%+10px)] w-[350px] [animation:slide-in_0.3s_ease] max-[600px]:w-auto">
          {props.content}
        </div>
      )}
    </div>
  );
}

export function Card(props: { children: JSX.Element[]; className?: string }) {
  return (
    <div
      className={clsx(
        "rounded-[10px] bg-white p-2.5 shadow-card",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function ListItem(props: {
  title?: string;
  subTitle?: string | JSX.Element;
  children?: JSX.Element | JSX.Element[];
  icon?: JSX.Element;
  className?: string;
  onClick?: (e: MouseEvent) => void;
  vertical?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex min-h-10 justify-between px-5 py-2.5 [animation:slide-in_ease_0.6s] [border-bottom:var(--border-in-light)]",
        props.vertical ? "flex-col items-start" : "items-center",
        props.className,
      )}
      onClick={props.onClick}
    >
      <div className="flex items-center">
        {props.icon && <div className="mr-2.5">{props.icon}</div>}
        <div
          className={clsx("text-sm [font-weight:bolder]", {
            "mb-[5px]": props.vertical,
          })}
        >
          <div>{props.title}</div>
          {props.subTitle && (
            <div
              className={clsx("text-xs font-normal", {
                "mb-0.5": props.vertical,
              })}
            >
              {props.subTitle}
            </div>
          )}
        </div>
      </div>
      {props.children}
    </div>
  );
}

export function List(props: { children: React.ReactNode; id?: string }) {
  return (
    <div
      className="mb-5 rounded-[10px] bg-white shadow-card [animation:slide-in_ease_0.3s] [border:var(--border-in-light)] [&>*:last-child]:border-0"
      id={props.id}
    >
      {props.children}
    </div>
  );
}

export function Loading() {
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LoadingIcon />
    </div>
  );
}

interface ModalProps {
  title: string;
  children?: any;
  actions?: React.ReactNode[];
  defaultMax?: boolean;
  footer?: React.ReactNode;
  onClose?: () => void;
}
export function Modal(props: ModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        props.onClose?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isMax, setMax] = useState(!!props.defaultMax);

  return (
    <div
      className={clsx(
        "min-w-[300px] rounded-xl bg-white shadow-card [animation:slide-in_ease_0.3s] max-[600px]:w-screen max-[600px]:rounded-b-none",
        isMax
          ? "flex h-[95vh] w-[95vw] max-w-none flex-col"
          : "w-[80vw] max-w-[900px]",
      )}
    >
      <div className="flex items-center justify-between p-5 [border-bottom:var(--border-in-light)]">
        <div className="text-base [font-weight:bolder]">{props.title}</div>

        <div className="flex">
          <div
            className="cursor-pointer hover:[filter:brightness(1.2)] [&:not(:last-child)]:mr-5"
            onClick={() => setMax(!isMax)}
          >
            {isMax ? <MinIcon /> : <MaxIcon />}
          </div>
          <div
            className="cursor-pointer hover:[filter:brightness(1.2)] [&:not(:last-child)]:mr-5"
            onClick={props.onClose}
          >
            <CloseIcon />
          </div>
        </div>
      </div>

      <div
        className={clsx(
          "max-h-[40vh] overflow-auto p-5 max-[600px]:max-h-[50vh]",
          { "max-h-none! grow": isMax },
        )}
      >
        {props.children}
      </div>

      <div className="flex justify-end p-5 shadow-panel [border-top:var(--border-in-light)]">
        {props.footer}
        <div className="flex items-center">
          {props.actions?.map((action, i) => (
            <div key={i} className="[&:not(:last-child)]:mr-5">
              {action}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function showModal(props: ModalProps) {
  const div = document.createElement("div");
  div.className = "modal-mask";
  document.body.appendChild(div);

  const root = createRoot(div);
  const closeModal = () => {
    props.onClose?.();
    root.unmount();
    div.remove();
  };

  div.onclick = (e) => {
    if (e.target === div) {
      closeModal();
    }
  };

  root.render(<Modal {...props} onClose={closeModal}></Modal>);
}

export type ToastProps = {
  content: string;
  action?: {
    text: string;
    onClick: () => void;
  };
  onClose?: () => void;
};

export function Toast(props: ToastProps) {
  return (
    <div className="pointer-events-none fixed bottom-[5vh] left-0 flex w-screen justify-center">
      <div className="[pointer-events:all] mb-5 flex max-w-[80vw] items-center break-all rounded-[50px] bg-white px-5 py-2.5 text-sm text-black shadow-card [border:var(--border-in-light)]">
        <span>{props.content}</span>
        {props.action && (
          <button
            onClick={() => {
              props.action?.onClick?.();
              props.onClose?.();
            }}
            className="cursor-pointer border-0 pl-5 text-primary opacity-80 [background:none] [font-family:inherit] hover:opacity-100"
          >
            {props.action.text}
          </button>
        )}
      </div>
    </div>
  );
}

export function showToast(
  content: string,
  action?: ToastProps["action"],
  delay = 3000,
) {
  const div = document.createElement("div");
  div.className =
    "fixed bottom-0 left-0 z-[99999] translate-y-0 opacity-100 [animation:slide-in_ease_0.6s] [transition:all_ease_0.3s]";
  document.body.appendChild(div);

  const root = createRoot(div);
  const close = () => {
    div.classList.add("translate-y-5!", "opacity-0!");

    setTimeout(() => {
      root.unmount();
      div.remove();
    }, 300);
  };

  setTimeout(() => {
    close();
  }, delay);

  root.render(<Toast content={content} action={action} onClose={close} />);
}

export type InputProps = React.HTMLProps<HTMLTextAreaElement> & {
  autoHeight?: boolean;
  rows?: number;
};

export function Input(props: InputProps) {
  return (
    <textarea
      {...props}
      className={clsx(
        "min-w-[50px] resize-none rounded-[10px] bg-white p-2.5 text-black [border:var(--border-in-light)] [font-family:inherit]",
        props.className,
      )}
    ></textarea>
  );
}

export function PasswordInput(
  props: HTMLProps<HTMLInputElement> & { aria?: string },
) {
  const [visible, setVisible] = useState(false);
  function changeVisibility() {
    setVisible(!visible);
  }

  return (
    <div className={"password-input-container"}>
      <IconButton
        aria={props.aria}
        icon={visible ? <EyeIcon /> : <EyeOffIcon />}
        onClick={changeVisibility}
        className={"password-eye"}
      />
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={"password-input"}
      />
    </div>
  );
}

export function Select(
  props: React.DetailedHTMLProps<
    React.SelectHTMLAttributes<HTMLSelectElement> & {
      align?: "left" | "center";
    },
    HTMLSelectElement
  >,
) {
  const { className, children, align, ...otherProps } = props;
  return (
    <div
      className={clsx(
        "relative max-w-fit",
        {
          "[&_option]:text-left": align === "left",
        },
        className,
      )}
    >
      <select
        className="h-full cursor-pointer appearance-none rounded-[10px] bg-white py-2.5 pl-2.5 pr-[35px] text-center text-black [border:var(--border-in-light)]"
        {...otherProps}
      >
        {children}
      </select>
      <DownIcon className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
    </div>
  );
}

export function showConfirm(content: any) {
  const div = document.createElement("div");
  div.className = "modal-mask";
  document.body.appendChild(div);

  const root = createRoot(div);
  const closeModal = () => {
    root.unmount();
    div.remove();
  };

  return new Promise<boolean>((resolve) => {
    root.render(
      <Modal
        title={Locale.UI.Confirm}
        actions={[
          <IconButton
            key="cancel"
            text={Locale.UI.Cancel}
            onClick={() => {
              resolve(false);
              closeModal();
            }}
            icon={<CancelIcon />}
            tabIndex={0}
            bordered
            shadow
          ></IconButton>,
          <IconButton
            key="confirm"
            text={Locale.UI.Confirm}
            type="primary"
            onClick={() => {
              resolve(true);
              closeModal();
            }}
            icon={<ConfirmIcon />}
            tabIndex={0}
            autoFocus
            bordered
            shadow
          ></IconButton>,
        ]}
        onClose={closeModal}
      >
        {content}
      </Modal>,
    );
  });
}

function PromptInput(props: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  const [input, setInput] = useState(props.value);
  const onInput = (value: string) => {
    props.onChange(value);
    setInput(value);
  };

  return (
    <textarea
      className="box-border h-full w-full resize-none rounded-[10px] bg-white p-2.5 text-black outline-none [border:var(--border-in-light)] [box-shadow:0_-2px_5px_rgba(0,0,0,0.03)] [font-family:inherit] focus:[border:1px_solid_var(--primary)]"
      autoFocus
      value={input}
      onInput={(e) => onInput(e.currentTarget.value)}
      rows={props.rows ?? 3}
    ></textarea>
  );
}

export function showPrompt(content: any, value = "", rows = 3) {
  const div = document.createElement("div");
  div.className = "modal-mask";
  document.body.appendChild(div);

  const root = createRoot(div);
  const closeModal = () => {
    root.unmount();
    div.remove();
  };

  return new Promise<string>((resolve) => {
    let userInput = value;

    root.render(
      <Modal
        title={content}
        actions={[
          <IconButton
            key="cancel"
            text={Locale.UI.Cancel}
            onClick={() => {
              closeModal();
            }}
            icon={<CancelIcon />}
            bordered
            shadow
            tabIndex={0}
          ></IconButton>,
          <IconButton
            key="confirm"
            text={Locale.UI.Confirm}
            type="primary"
            onClick={() => {
              resolve(userInput);
              closeModal();
            }}
            icon={<ConfirmIcon />}
            bordered
            shadow
            tabIndex={0}
          ></IconButton>,
        ]}
        onClose={closeModal}
      >
        <PromptInput
          onChange={(val) => (userInput = val)}
          value={value}
          rows={rows}
        ></PromptInput>
      </Modal>,
    );
  });
}

export function showImageModal(
  img: string,
  defaultMax?: boolean,
  style?: CSSProperties,
  boxStyle?: CSSProperties,
) {
  showModal({
    title: Locale.Export.Image.Modal,
    defaultMax: defaultMax,
    children: (
      <div style={{ display: "flex", justifyContent: "center", ...boxStyle }}>
        <img
          src={img}
          alt="preview"
          style={
            style ?? {
              maxWidth: "100%",
            }
          }
        ></img>
      </div>
    ),
  });
}

export function Selector<T>(props: {
  items: Array<{
    title: string;
    subTitle?: string;
    value: T;
    disable?: boolean;
  }>;
  defaultSelectedValue?: T[] | T;
  onSelection?: (selection: T[]) => void;
  onClose?: () => void;
  multiple?: boolean;
}) {
  const [selectedValues, setSelectedValues] = useState<T[]>(
    Array.isArray(props.defaultSelectedValue)
      ? props.defaultSelectedValue
      : props.defaultSelectedValue !== undefined
      ? [props.defaultSelectedValue]
      : [],
  );

  const handleSelection = (e: MouseEvent, value: T) => {
    if (props.multiple) {
      e.stopPropagation();
      const newSelectedValues = selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value];
      setSelectedValues(newSelectedValues);
      props.onSelection?.(newSelectedValues);
    } else {
      setSelectedValues([value]);
      props.onSelection?.([value]);
      props.onClose?.();
    }
  };

  return (
    <div
      className="fixed left-0 top-0 z-[999] flex h-screen w-screen items-center justify-center bg-[rgba(0,0,0,0.5)]"
      onClick={() => props.onClose?.()}
    >
      <div className="min-w-[300px] [&>div]:max-h-[90vh] [&>div]:overflow-x-hidden [&>div]:overflow-y-auto">
        <List>
          {props.items.map((item, i) => {
            const selected = selectedValues.includes(item.value);
            return (
              <ListItem
                className={clsx(
                  "cursor-pointer bg-white hover:[filter:brightness(0.95)] active:[filter:brightness(0.9)]",
                  {
                    "opacity-60": item.disable,
                  },
                )}
                key={i}
                title={item.title}
                subTitle={item.subTitle}
                icon={<Avatar model={item.value as string} />}
                onClick={(e) => {
                  if (item.disable) {
                    e.stopPropagation();
                  } else {
                    handleSelection(e, item.value);
                  }
                }}
              >
                {selected ? (
                  <div
                    style={{
                      height: 10,
                      width: 10,
                      backgroundColor: "var(--primary)",
                      borderRadius: 10,
                    }}
                  ></div>
                ) : (
                  <></>
                )}
              </ListItem>
            );
          })}
        </List>
      </div>
    </div>
  );
}
export function FullScreen(props: any) {
  const { children, right = 10, top = 10, ...rest } = props;
  const ref = useRef<HTMLDivElement>();
  const [fullScreen, setFullScreen] = useState(false);
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      ref.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);
  useEffect(() => {
    const handleScreenChange = (e: any) => {
      if (e.target === ref.current) {
        setFullScreen(!!document.fullscreenElement);
      }
    };
    document.addEventListener("fullscreenchange", handleScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleScreenChange);
    };
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }} {...rest}>
      <div style={{ position: "absolute", right, top }}>
        <IconButton
          icon={fullScreen ? <MinIcon /> : <MaxIcon />}
          onClick={toggleFullscreen}
          bordered
        />
      </div>
      {children}
    </div>
  );
}
