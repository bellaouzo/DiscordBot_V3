import { ActionResponder } from "./ActionResponder";
import { ResolveResponderLogger, ResponderDependencies } from "./ResponseTypes";
import { DeferResponder } from "./DeferResponder";
import { DmResponder } from "./DmResponder";
import { EditResponder } from "./EditResponder";
import { FollowUpResponder } from "./FollowUpResponder";
import { ReplyResponder } from "./ReplyResponder";
import { PaginatedResponder } from "./PaginatedResponder";
import {
  ComponentRouter,
  CreateComponentRouter,
} from "../Shared/ComponentRouter";
export type {
  ResponseOptions,
  ResponseResult,
  ResponseActionOptions,
  ResponderMessageOptions,
  ResponderEditOptions,
} from "./ResponseTypes";
export { ConvertToInteractionFlags } from "./ResponseTypes";

export interface ResponderSet {
  readonly replyResponder: ReplyResponder;
  readonly editResponder: EditResponder;
  readonly followUpResponder: FollowUpResponder;
  readonly deferResponder: DeferResponder;
  readonly actionResponder: ActionResponder;
  readonly dmResponder: DmResponder;
  readonly paginatedResponder: PaginatedResponder;
  readonly componentRouter: ComponentRouter;
}

export function CreateResponders(
  dependencies?: ResponderDependencies
): ResponderSet {
  const logger = ResolveResponderLogger(dependencies);
  const componentRouter = CreateComponentRouter(logger);

  const replyResponder = new ReplyResponder(logger);
  const editResponder = new EditResponder(logger);
  const followUpResponder = new FollowUpResponder(logger);
  const deferResponder = new DeferResponder(logger);
  const actionResponder = new ActionResponder(replyResponder, editResponder);
  const dmResponder = new DmResponder(logger);
  const paginatedResponder = new PaginatedResponder(
    replyResponder,
    editResponder,
    componentRouter,
    logger
  );

  return {
    replyResponder,
    editResponder,
    followUpResponder,
    deferResponder,
    actionResponder,
    dmResponder,
    paginatedResponder,
    componentRouter,
  };
}
