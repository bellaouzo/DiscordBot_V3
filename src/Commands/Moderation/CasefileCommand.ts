import { CreateCommand } from "@commands";
import { Config } from "@middleware";
import { HandleCasefileQuery } from "@commands/Moderation/Casefile/QueryFlow";

export const CasefileCommand = CreateCommand({
  name: "casefile",
  description: "View key moderation info for a user",
  group: "moderation",
  config: Config.mod().build(),
  execute: HandleCasefileQuery,
  configure: (builder) => {
    builder.addUserOption((option) =>
      option.setName("user").setDescription("User to view").setRequired(true),
    );
  },
});
