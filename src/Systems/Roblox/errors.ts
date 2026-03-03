export function GroupAuditErrorTitle(code: string | undefined): string {
  switch (code) {
    case "NOT_CONNECTED":
      return "Roblox Not Connected";
    case "NO_GROUP_KEY":
      return "No Group Key";
    case "KEY_TYPE_EXPERIENCE":
      return "Group Audit Not Available";
    case "INSUFFICIENT_SCOPE":
      return "Insufficient API Key Scope";
    case "MEMBER_NOT_FOUND":
      return "Member Not Found";
    case "RATE_LIMITED":
      return "Rate Limited";
    case "UPSTREAM_ERROR":
      return "Roblox API Error";
    case "INVALID_API_KEY":
      return "Invalid API Key";
    case "SIGNATURE_INVALID":
    case "SIGNATURE_USED":
      return "Setup Link Invalid";
    default:
      return "Group Audit Failed";
  }
}

export function GroupAuditErrorMessage(
  code: string | undefined,
  fallback: string,
): string {
  switch (code) {
    case "NOT_CONNECTED":
      return "No Roblox API key is configured for this server. Run `/roblox connect` to set one up.";
    case "NO_GROUP_KEY":
      return "This server must have a **group** API key configured. Run `/roblox connect` and link a group key.";
    case "KEY_TYPE_EXPERIENCE":
      return "Group audit is only available when this server is linked with a **group** API key. This server is linked with an experience (universe) key.";
    case "INSUFFICIENT_SCOPE":
      return "The configured API key does not have permission to read group membership. Check key scopes in Roblox Creator Hub.";
    case "MEMBER_NOT_FOUND":
      return "The player was not found in the group or the name/ID is invalid.";
    case "RATE_LIMITED":
      return "Too many requests. Please try again in a moment.";
    case "UPSTREAM_ERROR":
      return "The Roblox API returned an error. Please try again later.";
    case "INVALID_API_KEY":
      return "Roblox rejected the API key. Some endpoints (e.g. group info) only support **user (creator)** API keys, not group keys. In Roblox Creator Hub, create a key with the right scopes and reconnect using **User** (experience) if your bridge requires it for this action.";
    case "SIGNATURE_INVALID":
    case "SIGNATURE_USED":
      return "The setup link is invalid or has already been used. Run `/roblox connect` again to get a new link.";
    default:
      return fallback;
  }
}
