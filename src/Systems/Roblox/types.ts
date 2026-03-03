export interface RobloxBridgeCommandResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly id?: string;
  };
  readonly error?:
    | string
    | {
        readonly code?: string;
        readonly message?: string;
      };
}

export interface RobloxBridgeSettings {
  readonly url: string;
  readonly apiKey: string;
  readonly urlSigningSecret: string;
  readonly timeoutMs: number;
}

export interface RobloxBridgeError {
  readonly code?: string;
  readonly message?: string;
}

export interface DiscordModeratorInfo {
  readonly id: string;
  readonly username: string;
  readonly tag: string;
  readonly globalName?: string;
}

export interface RobloxPresencePlayer {
  readonly userId: number;
  readonly playerName: string;
  readonly displayName?: string;
}

export interface RobloxPresenceMatch {
  readonly serverId: string;
  readonly jobId?: string;
  readonly placeId?: string;
  readonly lastSeen?: number;
  readonly player?: RobloxPresencePlayer;
}

export interface RobloxPresenceResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly found?: boolean;
    readonly matches?: RobloxPresenceMatch[];
  };
  readonly error?:
    | string
    | {
        readonly code?: string;
        readonly message?: string;
      };
}

export interface RobloxCommandResultPayload {
  readonly id?: string;
  readonly ok?: boolean;
  readonly code?: string;
  readonly message?: string;
}

export interface RobloxCommandResultResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly commandId?: string;
    readonly result?: RobloxCommandResultPayload;
  };
  readonly error?: string | RobloxBridgeError;
}

export interface RobloxApiKeyStatusResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly configured?: boolean;
    readonly guildId?: string;
    readonly keyType?: string;
    readonly targetId?: string;
    readonly groupId?: string;
    readonly universeId?: string;
    readonly createdAt?: number;
    readonly updatedAt?: number;
  };
  readonly error?: string | RobloxBridgeError;
}

export interface RobloxGroupAuditData {
  readonly guildId?: string;
  readonly entries?: readonly unknown[];
  readonly player?: string;
  readonly userId?: string;
}

export interface RobloxGroupAuditResponse {
  readonly ok?: boolean;
  readonly data?: RobloxGroupAuditData;
  readonly error?: string | RobloxBridgeError;
}

export interface RobloxGroupInfoData {
  readonly id?: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly owner?: { readonly id?: string; readonly type?: string };
  readonly memberCount?: number;
  readonly publicEntryAllowed?: boolean;
  readonly locked?: boolean;
  readonly verified?: boolean;
  readonly createTime?: string;
  readonly updateTime?: string;
  readonly path?: string;
}

export interface RobloxGroupInfoResponse {
  readonly ok?: boolean;
  readonly data?: RobloxGroupInfoData;
  readonly error?: string | RobloxBridgeError;
}

export interface RobloxApiKeyDeleteResponse {
  readonly ok?: boolean;
  readonly data?: {
    readonly deleted?: boolean;
  };
  readonly error?: string | RobloxBridgeError;
}

export interface KickExecutionOutcome {
  readonly kind: "not_found" | "success" | "failure" | "timeout";
  readonly code?: string;
  readonly message?: string;
  readonly commandId?: string;
}

export const RESULT_POLL_INTERVAL_MS = 1500;
export const RESULT_POLL_TIMEOUT_MS = 20000;
