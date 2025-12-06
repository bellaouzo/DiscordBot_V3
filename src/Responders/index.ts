import { PaginatedResponder } from "./PaginatedResponder";
import { InteractionResponder } from "./InteractionResponder";
import { ButtonResponder } from "./ButtonResponder";
import { ResolveResponderLogger, ResponderDependencies } from "./ResponseTypes";
import {
  ComponentRouter,
  CreateComponentRouter,
} from "../Shared/ComponentRouter";
import {
  SelectMenuRouter,
  CreateSelectMenuRouter,
} from "../Shared/SelectMenuRouter";
import {
  UserSelectMenuRouter,
  CreateUserSelectMenuRouter,
} from "../Shared/UserSelectMenuRouter";
export type {
  ResponseOptions,
  ResponseResult,
  ResponseActionOptions,
  ResponderMessageOptions,
  ResponderEditOptions,
} from "./ResponseTypes";
export { ConvertToInteractionFlags } from "./ResponseTypes";
export { InteractionResponder } from "./InteractionResponder";
export { ButtonResponder } from "./ButtonResponder";
export { PaginatedResponder } from "./PaginatedResponder";

export interface ResponderSet {
  readonly interactionResponder: InteractionResponder;
  readonly buttonResponder: ButtonResponder;
  readonly paginatedResponder: PaginatedResponder;
  readonly componentRouter: ComponentRouter;
  readonly selectMenuRouter: SelectMenuRouter;
  readonly userSelectMenuRouter: UserSelectMenuRouter;
}

export function CreateResponders(
  dependencies?: ResponderDependencies,
): ResponderSet {
  const logger = ResolveResponderLogger(dependencies);
  const componentRouter = CreateComponentRouter(logger);
  const selectMenuRouter = CreateSelectMenuRouter(logger);
  const userSelectMenuRouter = CreateUserSelectMenuRouter(logger);
  const interactionResponder = new InteractionResponder(logger);
  const buttonResponder = new ButtonResponder(logger);
  const paginatedResponder = new PaginatedResponder(
    interactionResponder,
    buttonResponder,
    componentRouter,
    logger,
  );

  return {
    interactionResponder,
    buttonResponder,
    paginatedResponder,
    componentRouter,
    selectMenuRouter,
    userSelectMenuRouter,
  };
}
