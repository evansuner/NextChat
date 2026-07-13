import { useEffect, useRef, useState } from "react";
import { Path, SlotID } from "../constant";
import { IconButton } from "./button";
import { EmojiAvatar } from "./emoji";

import LeftIcon from "../icons/left.svg";
import LightningIcon from "../icons/lightning.svg";
import EyeIcon from "../icons/eye.svg";

import { useLocation, useNavigate } from "react-router-dom";
import { Mask, useMaskStore } from "../store/mask";
import Locale from "../locales";
import { useAppConfig, useChatStore } from "../store";
import { MaskAvatar } from "./mask";
import { useCommand } from "../command";
import { showConfirm } from "./ui-lib";
import { BUILTIN_MASK_STORE } from "../masks";
import clsx from "clsx";

function MaskItem(props: { mask: Mask; onClick?: () => void }) {
  return (
    <div
      className="flex cursor-pointer items-center mr-2.5 max-w-[8em] rounded-[10px] bg-white px-3.5 py-2.5 shadow-card [border:var(--border-in-light)] transform-[scale(1)] [transition:all_ease_0.3s] hover:z-999 hover:border-primary hover:transform-[translateY(-5px)_scale(1.1)]"
      onClick={props.onClick}
    >
      <MaskAvatar
        avatar={props.mask.avatar}
        model={props.mask.modelConfig.model}
      />
      <div className={clsx("ml-2.5 text-sm", "one-line")}>
        {props.mask.name}
      </div>
    </div>
  );
}

function useMaskGroup(masks: Mask[]) {
  const [groups, setGroups] = useState<Mask[][]>([]);

  useEffect(() => {
    const computeGroup = () => {
      const appBody = document.getElementById(SlotID.AppBody);
      if (!appBody || masks.length === 0) return;

      const rect = appBody.getBoundingClientRect();
      const maxWidth = rect.width;
      const maxHeight = rect.height * 0.6;
      const maskItemWidth = 120;
      const maskItemHeight = 50;

      const randomMask = () => masks[Math.floor(Math.random() * masks.length)];
      let maskIndex = 0;
      const nextMask = () => masks[maskIndex++ % masks.length];

      const rows = Math.ceil(maxHeight / maskItemHeight);
      const cols = Math.ceil(maxWidth / maskItemWidth);

      const newGroups = new Array(rows)
        .fill(0)
        .map((_, _i) =>
          new Array(cols)
            .fill(0)
            .map((_, j) => (j < 1 || j > cols - 2 ? randomMask() : nextMask())),
        );

      setGroups(newGroups);
    };

    computeGroup();

    window.addEventListener("resize", computeGroup);
    return () => window.removeEventListener("resize", computeGroup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return groups;
}

export function NewChat() {
  const chatStore = useChatStore();
  const maskStore = useMaskStore();

  const masks = maskStore.getAll();
  const groups = useMaskGroup(masks);

  const navigate = useNavigate();
  const config = useAppConfig();

  const maskRef = useRef<HTMLDivElement>(null);

  const { state } = useLocation();

  const startChat = (mask?: Mask) => {
    setTimeout(() => {
      chatStore.newSession(mask);
      navigate(Path.Chat);
    }, 10);
  };

  useCommand({
    mask: (id) => {
      try {
        const mask = maskStore.get(id) ?? BUILTIN_MASK_STORE.get(id);
        startChat(mask ?? undefined);
      } catch {
        console.error("[New Chat] failed to create chat from mask id=", id);
      }
    },
  });

  useEffect(() => {
    if (maskRef.current) {
      maskRef.current.scrollLeft =
        (maskRef.current.scrollWidth - maskRef.current.clientWidth) / 2;
    }
  }, [groups]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="flex w-full justify-between box-border p-2.5 animate-[slide-in-from-top_ease_0.3s]">
        <IconButton
          icon={<LeftIcon />}
          text={Locale.NewChat.Return}
          onClick={() => navigate(Path.Home)}
        ></IconButton>
        {!state?.fromHome && (
          <IconButton
            text={Locale.NewChat.NotShow}
            onClick={async () => {
              if (await showConfirm(Locale.NewChat.ConfirmNoShow)) {
                startChat();
                config.update(
                  (config) => (config.dontShowMaskSplashScreen = true),
                );
              }
            }}
          ></IconButton>
        )}
      </div>
      <div className="flex mt-[5vh] mb-5 animate-[slide-in_ease_0.3s]">
        <div className="rounded-[14px] bg-white px-2.5 py-5 shadow-card [border:var(--border-in-light)] transform-[scale(1)] first:transform-[rotate(-15deg)_translateY(5px)] last:transform-[rotate(15deg)_translateY(5px)]">
          <EmojiAvatar avatar="1f606" size={24} />
        </div>
        <div className="rounded-[14px] bg-white px-2.5 py-5 shadow-card [border:var(--border-in-light)] transform-[scale(1)] first:transform-[rotate(-15deg)_translateY(5px)] last:transform-[rotate(15deg)_translateY(5px)]">
          <EmojiAvatar avatar="1f916" size={24} />
        </div>
        <div className="rounded-[14px] bg-white px-2.5 py-5 shadow-card [border:var(--border-in-light)] transform-[scale(1)] first:transform-[rotate(-15deg)_translateY(5px)] last:transform-[rotate(15deg)_translateY(5px)]">
          <EmojiAvatar avatar="1f479" size={24} />
        </div>
      </div>

      <div className="text-[32px] font-[bolder] mb-[1vh] animate-[slide-in_ease_0.35s]">
        {Locale.NewChat.Title}
      </div>
      <div className="animate-[slide-in_ease_0.4s]">
        {Locale.NewChat.SubTitle}
      </div>

      <div className="flex justify-center mt-[5vh] mb-[2vh] text-xs animate-[slide-in_ease_0.45s]">
        <IconButton
          text={Locale.NewChat.More}
          onClick={() => navigate(Path.Masks)}
          icon={<EyeIcon />}
          bordered
          shadow
        />

        <IconButton
          text={Locale.NewChat.Skip}
          onClick={() => startChat()}
          icon={<LightningIcon />}
          type="primary"
          shadow
          className="ml-2.5"
        />
      </div>

      <div
        className="grow w-full items-center overflow-auto pt-5 animate-[slide-in_ease_0.5s] [-webkit-mask-image:linear-gradient(to_bottom,rgba(0,0,0,0),rgba(0,0,0,1),rgba(0,0,0,0))] mask-[linear-gradient(to_bottom,rgba(0,0,0,0),rgba(0,0,0,1),rgba(0,0,0,0))]"
        ref={maskRef}
      >
        {groups.map((masks, i) => (
          <div key={i} className="flex mb-2.5 even:ml-12.5">
            {masks.map((mask, index) => (
              <MaskItem
                key={index}
                mask={mask}
                onClick={() => startChat(mask)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
