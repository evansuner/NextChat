import DeleteIcon from "../icons/delete.svg";

import {
  DragDropContext,
  Droppable,
  Draggable,
  OnDragEndResponder,
} from "@hello-pangea/dnd";

import { useChatStore } from "../store";

import Locale from "../locales";
import { useLocation, useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { MaskAvatar } from "./mask";
import { Mask } from "../store/mask";
import { useRef, useEffect } from "react";
import { showConfirm } from "./ui-lib";
import { useMobileScreen } from "../utils";
import clsx from "clsx";

export function ChatItem(props: {
  onClick?: () => void;
  onDelete?: () => void;
  title: string;
  count: number;
  time: string;
  selected: boolean;
  id: string;
  index: number;
  narrow?: boolean;
  mask: Mask;
}) {
  const draggableRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (props.selected && draggableRef.current) {
      draggableRef.current?.scrollIntoView({
        block: "center",
      });
    }
  }, [props.selected]);

  const { pathname: currentPath } = useLocation();
  return (
    <Draggable draggableId={`${props.id}`} index={props.index}>
      {(provided) => (
        <div
          className={clsx(
            "group relative mb-[10px] cursor-pointer select-none rounded-[10px] border-2 bg-white shadow-card [content-visibility:auto] hover:bg-hover",
            props.narrow
              ? "flex min-h-[50px] items-center justify-center overflow-hidden p-0 [transition:all_ease_0.3s]"
              : "px-[14px] py-[10px] [transition:background-color_0.3s_ease]",
            props.selected &&
              (currentPath === Path.Chat || currentPath === Path.Home)
              ? "border-primary"
              : "border-transparent",
          )}
          onClick={props.onClick}
          ref={(ele) => {
            draggableRef.current = ele;
            provided.innerRef(ele);
          }}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          title={`${props.title}\n${Locale.ChatItem.ChatItemCount(
            props.count,
          )}`}
        >
          {props.narrow ? (
            <div className="flex flex-col justify-center p-1 leading-[0] [font-weight:lighter] text-black [transform:translateX(0)] [transition:all_ease_0.3s] group-hover:[transform:scale(0.7)_translateX(-50%)]">
              <div
                className={clsx(
                  "absolute flex justify-center opacity-20 [transform:scale(4)]",
                  "no-dark",
                )}
              >
                <MaskAvatar
                  avatar={props.mask.avatar}
                  model={props.mask.modelConfig.model}
                />
              </div>
              <div className="text-center text-[24px] [font-weight:bolder] text-primary opacity-60">
                {props.count}
              </div>
            </div>
          ) : (
            <>
              <div className="block w-[calc(100%-15px)] overflow-hidden text-ellipsis whitespace-nowrap text-[14px] [font-weight:bolder] [animation:slide-in_ease_0.3s]">
                {props.title}
              </div>
              <div className="mt-2 flex justify-between text-[12px] text-[rgb(166,166,166)] [animation:slide-in_ease_0.3s]">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {Locale.ChatItem.ChatItemCount(props.count)}
                </div>
                <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {props.time}
                </div>
              </div>
            </>
          )}

          <div
            className="absolute top-0 right-0 cursor-pointer opacity-0 [transition:all_ease_0.3s] group-hover:opacity-50 group-hover:[transform:translateX(-4px)] hover:opacity-100!"
            onClickCapture={(e) => {
              props.onDelete?.();
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <DeleteIcon />
          </div>
        </div>
      )}
    </Draggable>
  );
}

export function ChatList(props: { narrow?: boolean }) {
  const sessions = useChatStore((state) => state.sessions);
  const selectedIndex = useChatStore((state) => state.currentSessionIndex);
  const selectSession = useChatStore((state) => state.selectSession);
  const moveSession = useChatStore((state) => state.moveSession);
  const chatStore = useChatStore();
  const navigate = useNavigate();
  const isMobileScreen = useMobileScreen();

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;
    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    moveSession(source.index, destination.index);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="chat-list">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {Array.isArray(sessions) &&
              sessions.map((item, i) => (
                <ChatItem
                  title={item.topic}
                  time={new Date(item.lastUpdate).toLocaleString()}
                  count={item.messages.length}
                  key={item.id}
                  id={item.id}
                  index={i}
                  selected={i === selectedIndex}
                  onClick={() => {
                    navigate(Path.Chat);
                    selectSession(i);
                  }}
                  onDelete={async () => {
                    if (
                      (!props.narrow && !isMobileScreen) ||
                      (await showConfirm(Locale.Home.DeleteChat))
                    ) {
                      chatStore.deleteSession(i);
                    }
                  }}
                  narrow={props.narrow}
                  mask={item.mask}
                />
              ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
