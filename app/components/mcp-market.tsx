import { IconButton } from "./button";
import { ErrorBoundary } from "./error";
import EditIcon from "../icons/edit.svg";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import DeleteIcon from "../icons/delete.svg";
import RestartIcon from "../icons/reload.svg";
import EyeIcon from "../icons/eye.svg";
import GithubIcon from "../icons/github.svg";
import { List, ListItem, Modal, showToast } from "./ui-lib";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  addMcpServer,
  getClientsStatus,
  getClientTools,
  getMcpConfigFromFile,
  isMcpEnabled,
  pauseMcpServer,
  restartAllClients,
  resumeMcpServer,
} from "../mcp/actions";
import {
  ListToolsResponse,
  McpConfigData,
  PresetServer,
  ServerConfig,
  ServerStatusResponse,
} from "../mcp/types";
import clsx from "clsx";
import PlayIcon from "../icons/play.svg";
import StopIcon from "../icons/pause.svg";
import { Path } from "../constant";

interface ConfigProperty {
  type: string;
  description?: string;
  required?: boolean;
  minItems?: number;
}

export function McpMarketPage() {
  const navigate = useNavigate();
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [userConfig, setUserConfig] = useState<Record<string, any>>({});
  const [editingServerId, setEditingServerId] = useState<string | undefined>();
  const [tools, setTools] = useState<ListToolsResponse["tools"] | null>(null);
  const [viewingServerId, setViewingServerId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<McpConfigData>();
  const [clientStatuses, setClientStatuses] = useState<
    Record<string, ServerStatusResponse>
  >({});
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [presetServers, setPresetServers] = useState<PresetServer[]>([]);
  const [loadingStates, setLoadingStates] = useState<Record<string, string>>(
    {},
  );

  // 检查 MCP 是否启用
  useEffect(() => {
    const checkMcpStatus = async () => {
      const enabled = await isMcpEnabled();
      setMcpEnabled(enabled);
      if (!enabled) {
        navigate(Path.Home);
      }
    };
    checkMcpStatus();
  }, [navigate]);

  // 添加状态轮询
  useEffect(() => {
    if (!mcpEnabled || !config) return;

    const updateStatuses = async () => {
      const statuses = await getClientsStatus();
      setClientStatuses(statuses);
    };

    // 立即执行一次
    updateStatuses();
    // 每 1000ms 轮询一次
    const timer = setInterval(updateStatuses, 1000);

    return () => clearInterval(timer);
  }, [mcpEnabled, config]);

  // 加载预设服务器
  useEffect(() => {
    const loadPresetServers = async () => {
      if (!mcpEnabled) return;
      try {
        setLoadingPresets(true);
        const response = await fetch("https://nextchat.club/mcp/list");
        if (!response.ok) {
          throw new Error("Failed to load preset servers");
        }
        const data = await response.json();
        setPresetServers(data?.data ?? []);
      } catch (error) {
        console.error("Failed to load preset servers:", error);
        showToast("Failed to load preset servers");
      } finally {
        setLoadingPresets(false);
      }
    };
    loadPresetServers();
  }, [mcpEnabled]);

  // 加载初始状态
  useEffect(() => {
    const loadInitialState = async () => {
      if (!mcpEnabled) return;
      try {
        setIsLoading(true);
        const config = await getMcpConfigFromFile();
        setConfig(config);

        // 获取所有客户端的状态
        const statuses = await getClientsStatus();
        setClientStatuses(statuses);
      } catch (error) {
        console.error("Failed to load initial state:", error);
        showToast("Failed to load initial state");
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialState();
  }, [mcpEnabled]);

  // 加载当前编辑服务器的配置
  useEffect(() => {
    if (!editingServerId || !config) return;
    const currentConfig = config.mcpServers[editingServerId];
    if (currentConfig) {
      // 从当前配置中提取用户配置
      const preset = presetServers.find((s) => s.id === editingServerId);
      if (preset?.configSchema) {
        const userConfig: Record<string, any> = {};
        Object.entries(preset.argsMapping || {}).forEach(([key, mapping]) => {
          if (mapping.type === "spread") {
            // For spread types, extract the array from args.
            const startPos = mapping.position ?? 0;
            userConfig[key] = currentConfig.args.slice(startPos);
          } else if (mapping.type === "single") {
            // For single types, get a single value
            userConfig[key] = currentConfig.args[mapping.position ?? 0];
          } else if (
            mapping.type === "env" &&
            mapping.key &&
            currentConfig.env
          ) {
            // For env types, get values from environment variables
            userConfig[key] = currentConfig.env[mapping.key];
          }
        });
        setUserConfig(userConfig);
      }
    } else {
      setUserConfig({});
    }
  }, [editingServerId, config, presetServers]);

  if (!mcpEnabled) {
    return null;
  }

  // 检查服务器是否已添加
  const isServerAdded = (id: string) => {
    return id in (config?.mcpServers ?? {});
  };

  // 保存服务器配置
  const saveServerConfig = async () => {
    const preset = presetServers.find((s) => s.id === editingServerId);
    if (!preset || !preset.configSchema || !editingServerId) return;

    const savingServerId = editingServerId;
    setEditingServerId(undefined);

    try {
      updateLoadingState(savingServerId, "Updating configuration...");
      // 构建服务器配置
      const args = [...preset.baseArgs];
      const env: Record<string, string> = {};

      Object.entries(preset.argsMapping || {}).forEach(([key, mapping]) => {
        const value = userConfig[key];
        if (mapping.type === "spread" && Array.isArray(value)) {
          const pos = mapping.position ?? 0;
          args.splice(pos, 0, ...value);
        } else if (
          mapping.type === "single" &&
          mapping.position !== undefined
        ) {
          args[mapping.position] = value;
        } else if (
          mapping.type === "env" &&
          mapping.key &&
          typeof value === "string"
        ) {
          env[mapping.key] = value;
        }
      });

      const serverConfig: ServerConfig = {
        command: preset.command,
        args,
        ...(Object.keys(env).length > 0 ? { env } : {}),
      };

      const newConfig = await addMcpServer(savingServerId, serverConfig);
      setConfig(newConfig);
      showToast("Server configuration updated successfully");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to save configuration",
      );
    } finally {
      updateLoadingState(savingServerId, null);
    }
  };

  // 获取服务器支持的 Tools
  const loadTools = async (id: string) => {
    try {
      const result = await getClientTools(id);
      if (result) {
        setTools(result);
      } else {
        throw new Error("Failed to load tools");
      }
    } catch (error) {
      showToast("Failed to load tools");
      console.error(error);
      setTools(null);
    }
  };

  // 更新加载状态的辅助函数
  const updateLoadingState = (id: string, message: string | null) => {
    setLoadingStates((prev) => {
      if (message === null) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: message };
    });
  };

  // 修改添加服务器函数
  const addServer = async (preset: PresetServer) => {
    if (!preset.configurable) {
      try {
        const serverId = preset.id;
        updateLoadingState(serverId, "Creating MCP client...");

        const serverConfig: ServerConfig = {
          command: preset.command,
          args: [...preset.baseArgs],
        };
        const newConfig = await addMcpServer(preset.id, serverConfig);
        setConfig(newConfig);

        // 更新状态
        const statuses = await getClientsStatus();
        setClientStatuses(statuses);
      } finally {
        updateLoadingState(preset.id, null);
      }
    } else {
      // 如果需要配置，打开配置对话框
      setEditingServerId(preset.id);
      setUserConfig({});
    }
  };

  // 修改暂停服务器函数
  const pauseServer = async (id: string) => {
    try {
      updateLoadingState(id, "Stopping server...");
      const newConfig = await pauseMcpServer(id);
      setConfig(newConfig);
      showToast("Server stopped successfully");
    } catch (error) {
      showToast("Failed to stop server");
      console.error(error);
    } finally {
      updateLoadingState(id, null);
    }
  };

  // Restart server
  const restartServer = async (id: string) => {
    try {
      updateLoadingState(id, "Starting server...");
      await resumeMcpServer(id);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to start server, please check logs",
      );
      console.error(error);
    } finally {
      updateLoadingState(id, null);
    }
  };

  // Restart all clients
  const handleRestartAll = async () => {
    try {
      updateLoadingState("all", "Restarting all servers...");
      const newConfig = await restartAllClients();
      setConfig(newConfig);
      showToast("Restarting all clients");
    } catch (error) {
      showToast("Failed to restart clients");
      console.error(error);
    } finally {
      updateLoadingState("all", null);
    }
  };

  // Render configuration form
  const renderConfigForm = () => {
    const preset = presetServers.find((s) => s.id === editingServerId);
    if (!preset?.configSchema) return null;

    return Object.entries(preset.configSchema.properties).map(
      ([key, prop]: [string, ConfigProperty]) => {
        if (prop.type === "array") {
          const currentValue = userConfig[key as keyof typeof userConfig] || [];
          const itemLabel = (prop as any).itemLabel || key;
          const addButtonText =
            (prop as any).addButtonText || `Add ${itemLabel}`;

          return (
            <ListItem
              key={key}
              title={key}
              subTitle={prop.description}
              vertical
            >
              <div className="flex w-full flex-col gap-2.5">
                {(currentValue as string[]).map(
                  (value: string, index: number) => (
                    <div key={index} className="flex w-full gap-2.5">
                      <input
                        type="text"
                        className="box-border w-full max-w-full flex-1 rounded-[10px] bg-white p-2.5 text-sm text-black [border:var(--border-in-light)] hover:[border-color:var(--gray-300)] focus:outline-none focus:[border-color:var(--primary)] focus:[box-shadow:0_0_0_2px_var(--primary-10)]"
                        value={value}
                        placeholder={`${itemLabel} ${index + 1}`}
                        onChange={(e) => {
                          const newValue = [...currentValue] as string[];
                          newValue[index] = e.target.value;
                          setUserConfig({ ...userConfig, [key]: newValue });
                        }}
                      />
                      <IconButton
                        icon={<DeleteIcon />}
                        className="rounded-[10px] bg-transparent p-2 [color:var(--black-50)] [border:var(--border-in-light)] hover:bg-transparent hover:[border-color:var(--danger)] hover:[color:var(--danger)] [&_svg]:h-4 [&_svg]:w-4"
                        onClick={() => {
                          const newValue = [...currentValue] as string[];
                          newValue.splice(index, 1);
                          setUserConfig({ ...userConfig, [key]: newValue });
                        }}
                      />
                    </div>
                  ),
                )}
                <IconButton
                  icon={<AddIcon />}
                  text={addButtonText}
                  className="mt-1.25 flex items-center gap-1.25 self-start rounded-[10px] bg-transparent px-3 py-2 text-xs text-black [border:var(--border-in-light)] hover:bg-transparent hover:text-primary hover:[border-color:var(--primary)] [&_svg]:h-4 [&_svg]:w-4"
                  bordered
                  onClick={() => {
                    const newValue = [...currentValue, ""] as string[];
                    setUserConfig({ ...userConfig, [key]: newValue });
                  }}
                />
              </div>
            </ListItem>
          );
        } else if (prop.type === "string") {
          const currentValue = userConfig[key as keyof typeof userConfig] || "";
          return (
            <ListItem key={key} title={key} subTitle={prop.description}>
              <input
                aria-label={key}
                type="text"
                value={currentValue}
                placeholder={`Enter ${key}`}
                onChange={(e) => {
                  setUserConfig({ ...userConfig, [key]: e.target.value });
                }}
              />
            </ListItem>
          );
        }
        return null;
      },
    );
  };

  const checkServerStatus = (clientId: string) => {
    return clientStatuses[clientId] || { status: "undefined", errorMsg: null };
  };

  const getServerStatusDisplay = (clientId: string) => {
    const status = checkServerStatus(clientId);

    const statusMap = {
      undefined: null, // 未配置/未找到不显示
      // 添加初始化状态
      initializing: (
        <span className="ml-2.5 inline-flex items-center rounded bg-[#f59e0b] px-2 py-0.5 text-xs text-[#fff] [animation:pulse_1.5s_infinite]">
          Initializing
        </span>
      ),
      paused: (
        <span className="ml-2.5 inline-flex items-center rounded bg-[#6b7280] px-2 py-0.5 text-xs text-[#fff]">
          Stopped
        </span>
      ),
      active: (
        <span className="ml-2.5 inline-flex items-center rounded bg-[#22c55e] px-2 py-0.5 text-xs text-[#fff]">
          Running
        </span>
      ),
      error: (
        <span className="ml-2.5 inline-flex items-center rounded bg-[#ef4444] px-2 py-0.5 text-xs text-[#fff]">
          Error
          <span className="ml-1 text-xs">: {status.errorMsg}</span>
        </span>
      ),
    };

    return statusMap[status.status];
  };

  // Get the type of operation status
  const getOperationStatusType = (message: string) => {
    if (message.toLowerCase().includes("stopping")) return "stopping";
    if (message.toLowerCase().includes("starting")) return "starting";
    if (message.toLowerCase().includes("error")) return "error";
    return "default";
  };

  // 渲染服务器列表
  const renderServerList = () => {
    if (loadingPresets) {
      return (
        <div className="flex min-h-[200px] w-full items-center justify-center rounded-[10px] bg-white [border:var(--border-in-light)] [animation:slide-in_ease_0.3s]">
          <div className="text-center text-sm text-black opacity-50">
            Loading preset server list...
          </div>
        </div>
      );
    }

    if (!Array.isArray(presetServers) || presetServers.length === 0) {
      return (
        <div className="flex min-h-[200px] w-full items-center justify-center rounded-[10px] bg-white [border:var(--border-in-light)] [animation:slide-in_ease_0.3s]">
          <div className="text-center text-sm text-black opacity-50">
            No servers available
          </div>
        </div>
      );
    }

    return presetServers
      .filter((server) => {
        if (searchText.length === 0) return true;
        const searchLower = searchText.toLowerCase();
        return (
          server.name.toLowerCase().includes(searchLower) ||
          server.description.toLowerCase().includes(searchLower) ||
          server.tags.some((tag) => tag.toLowerCase().includes(searchLower))
        );
      })
      .sort((a, b) => {
        const aStatus = checkServerStatus(a.id).status;
        const bStatus = checkServerStatus(b.id).status;
        const aLoading = loadingStates[a.id];
        const bLoading = loadingStates[b.id];

        // 定义状态优先级
        const statusPriority: Record<string, number> = {
          error: 0, // Highest priority for error status
          active: 1, // Second for active
          initializing: 2, // Initializing
          starting: 3, // Starting
          stopping: 4, // Stopping
          paused: 5, // Paused
          undefined: 6, // Lowest priority for undefined
        };

        // Get actual status (including loading status)
        const getEffectiveStatus = (status: string, loading?: string) => {
          if (loading) {
            const operationType = getOperationStatusType(loading);
            return operationType === "default" ? status : operationType;
          }

          if (status === "initializing" && !loading) {
            return "active";
          }

          return status;
        };

        const aEffectiveStatus = getEffectiveStatus(aStatus, aLoading);
        const bEffectiveStatus = getEffectiveStatus(bStatus, bLoading);

        // 首先按状态排序
        if (aEffectiveStatus !== bEffectiveStatus) {
          return (
            (statusPriority[aEffectiveStatus] ?? 6) -
            (statusPriority[bEffectiveStatus] ?? 6)
          );
        }

        // Sort by name when statuses are the same
        return a.name.localeCompare(b.name);
      })
      .map((server) => (
        <div
          className={clsx(
            "bg-white p-5 [transition:all_0.3s_ease] [border:var(--border-in-light)] [animation:slide-in_ease_0.3s] first:rounded-t-[10px] last:rounded-b-[10px] [&:not(:last-child)]:border-b-0",
            loadingStates[server.id] &&
              "relative after:absolute after:inset-0 after:content-[''] after:[background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] after:[background-size:200%_100%] after:[animation:loading-pulse_1.5s_infinite]",
          )}
          key={server.id}
        >
          <div className="flex w-full items-start justify-between">
            <div className="mr-5 max-w-[calc(100%-300px)] grow">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                {server.name}
                {loadingStates[server.id] && (
                  <span
                    className="ml-2.5 inline-flex items-center rounded bg-[#16a34a] px-2 py-0.5 text-xs text-[#fff] [animation:pulse_1.5s_infinite] data-[status=stopping]:bg-[#9ca3af] data-[status=starting]:bg-[#4ade80] data-[status=error]:bg-[#f87171]"
                    data-status={getOperationStatusType(
                      loadingStates[server.id],
                    )}
                  >
                    {loadingStates[server.id]}
                  </span>
                )}
                {!loadingStates[server.id] && getServerStatusDisplay(server.id)}
                {server.repo && (
                  <a
                    href={server.repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary no-underline opacity-80 [transition:opacity_0.2s] hover:opacity-100 [&_svg]:h-3.5 [&_svg]:w-3.5"
                    title="Open repository"
                  >
                    <GithubIcon />
                  </a>
                )}
              </div>
              <div className="mb-2 flex flex-wrap gap-1">
                {server.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="rounded bg-gray px-1.5 py-0.5 text-[10px] text-black opacity-80"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div
                className={clsx(
                  "overflow-hidden text-ellipsis whitespace-nowrap text-xs text-black",
                  "one-line",
                )}
                title={server.description}
              >
                {server.description}
              </div>
            </div>
            <div className="flex min-w-[180px] shrink-0 items-start justify-end gap-3">
              {isServerAdded(server.id) ? (
                <>
                  {server.configurable && (
                    <IconButton
                      icon={<EditIcon />}
                      text="Configure"
                      onClick={() => setEditingServerId(server.id)}
                      disabled={isLoading}
                    />
                  )}
                  {checkServerStatus(server.id).status === "paused" ? (
                    <>
                      <IconButton
                        icon={<PlayIcon />}
                        text="Start"
                        onClick={() => restartServer(server.id)}
                        disabled={isLoading}
                      />
                      {/* <IconButton
                        icon={<DeleteIcon />}
                        text="Remove"
                        onClick={() => removeServer(server.id)}
                        disabled={isLoading}
                      /> */}
                    </>
                  ) : (
                    <>
                      <IconButton
                        icon={<EyeIcon />}
                        text="Tools"
                        onClick={async () => {
                          setViewingServerId(server.id);
                          await loadTools(server.id);
                        }}
                        disabled={
                          isLoading ||
                          checkServerStatus(server.id).status === "error"
                        }
                      />
                      <IconButton
                        icon={<StopIcon />}
                        text="Stop"
                        onClick={() => pauseServer(server.id)}
                        disabled={isLoading}
                      />
                    </>
                  )}
                </>
              ) : (
                <IconButton
                  icon={<AddIcon />}
                  text="Add"
                  onClick={() => addServer(server)}
                  disabled={isLoading}
                />
              )}
            </div>
          </div>
        </div>
      ));
  };

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col">
        <div className="window-header">
          <div className="window-header-title">
            <div className="window-header-main-title">
              MCP Market
              {loadingStates["all"] && (
                <span className="ml-2 text-xs font-normal text-primary opacity-80">
                  {loadingStates["all"]}
                </span>
              )}
            </div>
            <div className="window-header-sub-title">
              {Object.keys(config?.mcpServers ?? {}).length} servers configured
            </div>
          </div>

          <div className="window-actions">
            <div className="window-action-button">
              <IconButton
                icon={<RestartIcon />}
                bordered
                onClick={handleRestartAll}
                text="Restart All"
                disabled={isLoading}
              />
            </div>
            <div className="window-action-button">
              <IconButton
                icon={<CloseIcon />}
                bordered
                onClick={() => navigate(-1)}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-5 flex h-10 w-full max-w-full [animation:slide-in_ease_0.3s]">
            <input
              type="text"
              className="min-w-0 max-w-full grow"
              placeholder={"Search MCP Server"}
              autoFocus
              onInput={(e) => setSearchText(e.currentTarget.value)}
            />
          </div>

          <div className="flex flex-col gap-px">{renderServerList()}</div>
        </div>

        {/*编辑服务器配置*/}
        {editingServerId && (
          <div className="modal-mask">
            <Modal
              title={`Configure Server - ${editingServerId}`}
              onClose={() => !isLoading && setEditingServerId(undefined)}
              actions={[
                <IconButton
                  key="cancel"
                  text="Cancel"
                  onClick={() => setEditingServerId(undefined)}
                  bordered
                  disabled={isLoading}
                />,
                <IconButton
                  key="confirm"
                  text="Save"
                  type="primary"
                  onClick={saveServerConfig}
                  bordered
                  disabled={isLoading}
                />,
              ]}
            >
              <List>{renderConfigForm()}</List>
            </Modal>
          </div>
        )}

        {viewingServerId && (
          <div className="modal-mask">
            <Modal
              title={`Server Details - ${viewingServerId}`}
              onClose={() => setViewingServerId(undefined)}
              actions={[
                <IconButton
                  key="close"
                  text="Close"
                  onClick={() => setViewingServerId(undefined)}
                  bordered
                />,
              ]}
            >
              <div className="box-border flex w-full max-w-full flex-col gap-4 overflow-x-hidden break-words p-5">
                {isLoading ? (
                  <div>Loading...</div>
                ) : tools?.tools ? (
                  tools.tools.map(
                    (tool: ListToolsResponse["tools"], index: number) => (
                      <div key={index} className="box-border w-full">
                        <div className="mb-2 box-border w-full pl-3 text-sm font-semibold text-black [border-left:3px_solid_var(--primary)]">
                          {tool.name}
                        </div>
                        <div className="box-border w-full pl-[15px] text-[13px] leading-[1.6] [color:var(--gray-500)]">
                          {tool.description}
                        </div>
                      </div>
                    ),
                  )
                ) : (
                  <div>No tools available</div>
                )}
              </div>
            </Modal>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
