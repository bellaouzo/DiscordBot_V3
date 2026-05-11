import { ApiFeatureWithRequiredKey, GetRequiredFeatureApiKey } from "@config/ApiConfig";
import { CommandContext } from "@commands";

export function RequireFeatureApiKey(options: {
  feature: ApiFeatureWithRequiredKey;
  context: CommandContext;
  commandName: string;
}): string | null {
  const requirement = GetRequiredFeatureApiKey(options.feature);
  if (requirement.configured && requirement.apiKey) {
    return requirement.apiKey;
  }

  options.context.logger.Warn("Missing required API credential", {
    extra: {
      command: options.commandName,
      feature: options.feature,
      envVar: requirement.envVar,
    },
  });
  return null;
}
