import { EditResponder } from "./EditResponder";
import { ReplyResponder } from "./ReplyResponder";
import { ResponseActionOptions } from "./ResponseTypes";

export class ActionResponder {
  constructor(
    private readonly replyResponder: ReplyResponder,
    private readonly editResponder: EditResponder
  ) {}

  async Send(options: ResponseActionOptions): Promise<void> {
    await this.replyResponder.Send(
      options.interaction,
      typeof options.message === "string"
        ? { content: options.message }
        : { ...options.message, ephemeral: false }
    );

    await options.action();

    if (options.followUp) {
      const followUp =
        typeof options.followUp === "function"
          ? options.followUp()
          : options.followUp;
      await this.editResponder.Send(
        options.interaction,
        typeof followUp === "string"
          ? { content: followUp }
          : { ...followUp, ephemeral: false }
      );
    }
  }
}
