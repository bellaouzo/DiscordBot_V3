import { PaginatedResponder } from "./PaginatedResponder";
import { InteractionResponder } from "./InteractionResponder";
import { ButtonResponder } from "./ButtonResponder";
import type { ResponderDependencies } from "./ResponseTypes";
import { ResolveResponderLogger } from "./ResponseTypes";
import type { ComponentRouter } from "@shared/ComponentRouter";
import { CreateComponentRouter } from "@shared/ComponentRouter";
import type { SelectMenuRouter } from "@shared/SelectMenuRouter";
import { CreateSelectMenuRouter } from "@shared/SelectMenuRouter";
import type { UserSelectMenuRouter } from "@shared/UserSelectMenuRouter";
import { CreateUserSelectMenuRouter } from "@shared/UserSelectMenuRouter";
import type { ModalRouter } from "@shared/ModalRouter";
import { CreateModalRouter } from "@shared/ModalRouter";
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

/**
 * Set of responders and routers passed to commands via context.responders.
 */
export interface ResponderSet {
  readonly interactionResponder: InteractionResponder;
  readonly buttonResponder: ButtonResponder;
  readonly paginatedResponder: PaginatedResponder;
  readonly componentRouter: ComponentRouter;
  readonly selectMenuRouter: SelectMenuRouter;
  readonly userSelectMenuRouter: UserSelectMenuRouter;
  readonly modalRouter: ModalRouter;
}

/**
 * Creates the default responder set. Use optional dependencies to override logger.
 *
 * @param dependencies - Optional logger or other overrides
 * @returns ResponderSet for command context
 */
export function CreateResponders(
  dependencies?: ResponderDependencies,
): ResponderSet {
  const logger = ResolveResponderLogger(dependencies);
  const componentRouter = CreateComponentRouter(logger);
  const selectMenuRouter = CreateSelectMenuRouter(logger);
  const userSelectMenuRouter = CreateUserSelectMenuRouter(logger);
  const modalRouter = CreateModalRouter(logger);
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
    modalRouter,
  };
}
