import {
  ChatInputCommandInteraction,
  MessageFlags
} from "discord.js";
import { CommandContext, CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory, RequestJson, RequireFeatureApiKey } from "@utilities";
import { LoadApiConfig } from "@config/ApiConfig";

interface WeatherData {
  name: string;
  sys: {
    country: string;
    sunrise: number;
    sunset: number;
  };
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    temp_min: number;
    temp_max: number;
  };
  weather: Array<{
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
  timezone: number;
}

interface WeatherError {
  cod: string | number;
  message: string;
}

const WEATHER_EMOJIS: Record<string, string> = {
  "01d": "☀️", // Clear sky day
  "01n": "🌙", // Clear sky night
  "02d": "⛅", // Few clouds day
  "02n": "☁️", // Few clouds night
  "03d": "☁️", // Scattered clouds
  "03n": "☁️",
  "04d": "☁️", // Broken clouds
  "04n": "☁️",
  "09d": "🌧️", // Shower rain
  "09n": "🌧️",
  "10d": "🌦️", // Rain day
  "10n": "🌧️", // Rain night
  "11d": "⛈️", // Thunderstorm
  "11n": "⛈️",
  "13d": "❄️", // Snow
  "13n": "❄️",
  "50d": "🌫️", // Mist
  "50n": "🌫️",
};

function GetWeatherEmoji(iconCode: string): string {
  return WEATHER_EMOJIS[iconCode] ?? "🌡️";
}

function FormatTemperature(kelvin: number): {
  celsius: number;
  fahrenheit: number;
} {
  const celsius = Math.round(kelvin - 273.15);
  const fahrenheit = Math.round(((kelvin - 273.15) * 9) / 5 + 32);
  return { celsius, fahrenheit };
}

function FormatUnixTime(unix: number, timezoneOffset: number): string {
  const date = new Date((unix + timezoneOffset) * 1000);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

const apiConfig = LoadApiConfig();

async function ExecuteWeather(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
): Promise<void> {
  const { interactionResponder } = context.responders;
  const apiKey = RequireFeatureApiKey({
    feature: "weather",
    context,
    commandName: "weather",
  });

  if (!apiKey) {
    const embed = EmbedFactory.CreateError({
      title: "Weather Unavailable",
      description:
        "Weather functionality is not configured. Please ask the bot owner to add an OpenWeatherMap API key.",
    });
    await interactionResponder.Reply(interaction, {
      embeds: [embed.toJSON()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const location = interaction.options.getString("location", true);

  await interactionResponder.Defer(interaction, false);

  try {
    const response = await RequestJson<WeatherData | WeatherError>(
      `${apiConfig.weather.url}/weather`,
      {
        query: {
          q: location,
          appid: apiKey,
        },
        timeoutMs: apiConfig.weather.timeoutMs,
      }
    );

    if (!response.ok || !response.data) {
      context.logger.Error("Weather API error", {
        extra: {
          status: response.status,
          error: response.error,
        },
      });
      const embed = EmbedFactory.CreateError({
        title: "Weather Error",
        description:
          "An error occurred while fetching weather data. Please try again later.",
      });
      await interactionResponder.Edit(interaction, {
        embeds: [embed.toJSON()],
      });
      return;
    }

    const data = response.data;

    if ("cod" in data && data.cod !== 200) {
      const embed = EmbedFactory.CreateError({
        title: "Location Not Found",
        description: `Could not find weather data for "${location}". Please try a different city name or format (e.g., "London, UK").`,
      });
      await interactionResponder.Edit(interaction, {
        embeds: [embed.toJSON()],
      });
      return;
    }

    const weather = data as WeatherData;
    const temp = FormatTemperature(weather.main.temp);
    const feelsLike = FormatTemperature(weather.main.feels_like);
    const tempMin = FormatTemperature(weather.main.temp_min);
    const tempMax = FormatTemperature(weather.main.temp_max);
    const condition = weather.weather[0];
    const emoji = GetWeatherEmoji(condition.icon);
    const sunrise = FormatUnixTime(weather.sys.sunrise, weather.timezone);
    const sunset = FormatUnixTime(weather.sys.sunset, weather.timezone);
    const windSpeedKmh = Math.round(weather.wind.speed * 3.6);
    const windSpeedMph = Math.round(weather.wind.speed * 2.237);

    const embed = EmbedFactory.Create({
      title: `${emoji} Weather in ${weather.name}, ${weather.sys.country}`,
      description: `**${condition.main}** — ${condition.description.charAt(0).toUpperCase() + condition.description.slice(1)}`,
      thumbnail: `https://openweathermap.org/img/wn/${condition.icon}@2x.png`,
    });

    embed.addFields(
      {
        name: "🌡️ Temperature",
        value: `**${temp.celsius}°C** / **${temp.fahrenheit}°F**\nFeels like: ${feelsLike.celsius}°C / ${feelsLike.fahrenheit}°F`,
        inline: true,
      },
      {
        name: "📊 High / Low",
        value: `High: ${tempMax.celsius}°C / ${tempMax.fahrenheit}°F\nLow: ${tempMin.celsius}°C / ${tempMin.fahrenheit}°F`,
        inline: true,
      },
      {
        name: "💧 Humidity",
        value: `${weather.main.humidity}%`,
        inline: true,
      },
      {
        name: "💨 Wind Speed",
        value: `${windSpeedKmh} km/h / ${windSpeedMph} mph`,
        inline: true,
      },
      {
        name: "🌅 Sunrise",
        value: sunrise,
        inline: true,
      },
      {
        name: "🌇 Sunset",
        value: sunset,
        inline: true,
      }
    );

    await interactionResponder.Edit(interaction, {
      embeds: [embed.toJSON()],
    });
  } catch (error) {
    context.logger.Error("Weather API error", { error });
    const embed = EmbedFactory.CreateError({
      title: "Weather Error",
      description:
        "An error occurred while fetching weather data. Please try again later.",
    });
    await interactionResponder.Edit(interaction, {
      embeds: [embed.toJSON()],
    });
  }
}

export const WeatherCommand = CreateCommand({
  name: "weather",
  description: "Get current weather for a location",
  group: "fun",
  configure: (builder) => {
    builder.addStringOption((option) =>
      option
        .setName("location")
        .setDescription("City name (e.g., 'London' or 'Paris, FR')")
        .setRequired(true)
    );
  },
  config: Config.utility(5),
  execute: ExecuteWeather,
});
