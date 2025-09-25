import { ActionResponder } from './ActionResponder'
import { ResolveResponderLogger, ResponderDependencies } from './ResponseTypes'
import { DeferResponder } from './DeferResponder'
import { DmResponder } from './DmResponder'
import { EditResponder } from './EditResponder'
import { FollowUpResponder } from './FollowUpResponder'
import { ReplyResponder } from './ReplyResponder'
export type { ResponseOptions, ResponseResult, ResponseActionOptions, ResponderMessageOptions, ResponderEditOptions } from './ResponseTypes'

export interface ResponderSet {
  readonly replyResponder: ReplyResponder
  readonly editResponder: EditResponder
  readonly followUpResponder: FollowUpResponder
  readonly deferResponder: DeferResponder
  readonly actionResponder: ActionResponder
  readonly dmResponder: DmResponder
}

export function CreateResponders(dependencies?: ResponderDependencies): ResponderSet {
  const logger = ResolveResponderLogger(dependencies)

  const replyResponder = new ReplyResponder(logger)
  const editResponder = new EditResponder(logger)
  const followUpResponder = new FollowUpResponder(logger)
  const deferResponder = new DeferResponder(logger)
  const actionResponder = new ActionResponder(replyResponder, editResponder, logger)
  const dmResponder = new DmResponder(logger)

  return {
    replyResponder,
    editResponder,
    followUpResponder,
    deferResponder,
    actionResponder,
    dmResponder
  }
}

