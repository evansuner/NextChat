class ChatControllerPoolClass {
  private controllers = new Map<string, AbortController>();

  private makeKey(sessionId: string, messageId: string | number) {
    return `${sessionId}:${messageId}`;
  }

  addController(
    sessionId: string,
    messageId: string | number,
    controller: AbortController,
  ) {
    this.controllers.set(this.makeKey(sessionId, messageId), controller);
  }

  remove(sessionId: string, messageId: string | number) {
    this.controllers.delete(this.makeKey(sessionId, messageId));
  }

  stop(sessionId: string, messageId: string | number) {
    const key = this.makeKey(sessionId, messageId);
    const controller = this.controllers.get(key);
    controller?.abort();
    this.controllers.delete(key);
  }

  stopAll() {
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
  }

  hasPending() {
    return this.controllers.size > 0;
  }
}

export const ChatControllerPool = new ChatControllerPoolClass();

export * from "./api";
