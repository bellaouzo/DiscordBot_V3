import { ChatInputCommandInteraction } from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory, RequestJson } from "@utilities";
import { LoadApiConfig } from "@config/ApiConfig";

interface MyMemoryResponse {
  responseData?: {
    translatedText?: string;
  };
  responseStatus?: number;
  matches?: Array<{
    translation?: string;
    quality?: number;
  }>;
}

const apiConfig = LoadApiConfig();

const LANGUAGE_CODES: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  italian: "it",
  portuguese: "pt",
  russian: "ru",
  japanese: "ja",
  chinese: "zh",
  korean: "ko",
  arabic: "ar",
  hindi: "hi",
  dutch: "nl",
  polish: "pl",
  turkish: "tr",
  swedish: "sv",
  danish: "da",
  norwegian: "no",
  finnish: "fi",
  greek: "el",
  czech: "cs",
  romanian: "ro",
  hungarian: "hu",
  thai: "th",
  vietnamese: "vi",
  indonesian: "id",
  ukrainian: "uk",
};

function NormalizeLanguageCode(input: string): string {
  const normalized = input.toLowerCase().trim();
  return LANGUAGE_CODES[normalized] || normalized;
}

async function ExecuteTranslate(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;

  const text = interaction.options.getString("text", true);
  const targetLang = interaction.options.getString("target", true);
  const sourceLang = interaction.options.getString("source");

  if (text.length > 500) {
    const embed = EmbedFactory.CreateError({
      title: "Text Too Long",
      description: "Text must be 500 characters or less.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      ephemeral: true,
    });
    return;
  }

  await interactionResponder.Defer(interaction, true);

  try {
    const targetCode = NormalizeLanguageCode(targetLang);
    const sourceCode = sourceLang ? NormalizeLanguageCode(sourceLang) : "en";

    // MyMemory API uses GET with query parameters
    const response = await RequestJson<MyMemoryResponse>(
      `${apiConfig.translate.url}/get`,
      {
        query: {
          q: text,
          langpair: `${sourceCode}|${targetCode}`,
        },
        timeoutMs: apiConfig.translate.timeoutMs,
      }
    );

    if (!response.ok || !response.data) {
      context.logger.Error("Translation API error", {
        extra: {
          status: response.status,
          error: response.error,
          raw: response.raw,
        },
      });

      let errorMessage =
        "Failed to translate text. The translation service may be temporarily unavailable.";
      if (response.raw) {
        try {
          const errorData = JSON.parse(response.raw);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Ignore parse errors
        }
      }

      const embed = EmbedFactory.CreateError({
        title: "Translation Error",
        description: errorMessage,
      });
      await interactionResponder.Edit(interaction, {
        embeds: [embed.toJSON()],
      });
      return;
    }

    const data = response.data;

    if (!data || !data.responseData?.translatedText) {
      // Fallback to best match if available
      const bestMatch = data?.matches?.[0]?.translation;
      if (bestMatch) {
        const embed = EmbedFactory.Create({
          title: "🌐 Translation",
          description: `**Original:**\n${text}\n\n**Translated:**\n${bestMatch}`,
        });

        embed.setFooter({
          text: `From: ${sourceCode} → To: ${targetCode} (Note: Quality may vary)`,
        });

        await interactionResponder.Edit(interaction, {
          embeds: [embed.toJSON()],
        });
        return;
      }

      const embed = EmbedFactory.CreateError({
        title: "Translation Failed",
        description:
          "The translation service returned an error. Please check your language codes and try again.",
      });
      await interactionResponder.Edit(interaction, {
        embeds: [embed.toJSON()],
      });
      return;
    }

    const translatedText = data.responseData.translatedText;

    const embed = EmbedFactory.Create({
      title: "🌐 Translation",
      description: `**Original:**\n${text}\n\n**Translated:**\n${translatedText}`,
    });

    embed.setFooter({
      text: `From: ${sourceCode === "auto" ? "Auto-detected" : sourceCode} → To: ${targetCode}`,
    });

    await interactionResponder.Edit(interaction, {
      embeds: [embed.toJSON()],
    });
  } catch (error) {
    context.logger.Error("Translate command error", { error });
    const embed = EmbedFactory.CreateError({
      title: "Translation Error",
      description:
        "An error occurred while translating. Please try again later.",
    });
    await interactionResponder.Edit(interaction, {
      embeds: [embed.toJSON()],
    });
  }
}

export const TranslateCommand = CreateCommand({
  name: "translate",
  description: "Translate text to another language using LibreTranslate",
  group: "fun",
  configure: (builder) => {
    builder
      .addStringOption((option) =>
        option
          .setName("text")
          .setDescription("Text to translate")
          .setRequired(true)
          .setMaxLength(500)
      )
      .addStringOption((option) =>
        option
          .setName("target")
          .setDescription("Target language (e.g., spanish, es, fr, de)")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("source")
          .setDescription(
            "Source language (optional, auto-detects if not specified)"
          )
          .setRequired(false)
      );
  },
  config: Config.utility(3),
  execute: ExecuteTranslate,
});
