import { PaginatedResponder } from "./PaginatedResponder";
import { InteractionResponder } from "./InteractionResponder";
import { ResolveResponderLogger, ResponderDependencies } from "./ResponseTypes";
import {
  ComponentRouter,
  CreateComponentRouter,
} from "../Shared/ComponentRouter";
import {
  SelectMenuRouter,
  CreateSelectMenuRouter,
} from "../Shared/SelectMenuRouter";
export type {
  ResponseOptions,
  ResponseResult,
  ResponseActionOptions,
  ResponderMessageOptions,
  ResponderEditOptions,
} from "./ResponseTypes";
export { ConvertToInteractionFlags } from "./ResponseTypes";
export { InteractionResponder } from "./InteractionResponder";
export { PaginatedResponder } from "./PaginatedResponder";

export interface ResponderSet {
  readonly interactionResponder: InteractionResponder;
  readonly paginatedResponder: PaginatedResponder;
  readonly componentRouter: ComponentRouter;
  readonly selectMenuRouter: SelectMenuRouter;
}

export function CreateResponders(
  dependencies?: ResponderDependencies
): ResponderSet {
  const logger = ResolveResponderLogger(dependencies);
  const componentRouter = CreateComponentRouter(logger);
  const selectMenuRouter = CreateSelectMenuRouter(logger);
  const interactionResponder = new InteractionResponder(logger);
  const paginatedResponder = new PaginatedResponder(
    interactionResponder,
    componentRouter,
    logger
  );

  return {
    interactionResponder,
    paginatedResponder,
    componentRouter,
    selectMenuRouter,
  };
}
