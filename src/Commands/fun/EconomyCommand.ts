import { CreateCommand } from "@commands/CommandFactory";
import { Config } from "@middleware";
import { EmbedFactory } from "@utilities";
import { MIN_BET, MAX_BET } from "@systems/Economy/constants";
import { HandleBalance } from "@systems/Economy/handlers/BalanceHandler";
import { HandleDaily } from "@systems/Economy/handlers/DailyHandler";
import { HandleFlip } from "@systems/Economy/handlers/FlipHandler";
import { HandleDice } from "@systems/Economy/handlers/DiceHandler";
import { HandleRps } from "@systems/Economy/handlers/RpsHandler";
import { HandleCrash } from "@systems/Economy/handlers/CrashHandler";
import { HandleHorseRace } from "@systems/Economy/handlers/HorseRaceHandler";
import { HandleScratch } from "@systems/Economy/handlers/ScratchHandler";
import { HandleBlackjack } from "@systems/Economy/handlers/BlackjackHandler";
import { HandleLeaderboard } from "@systems/Economy/handlers/LeaderboardHandler";
import { HandleGift } from "@systems/Economy/handlers/GiftHandler";
import { HandleSlots } from "@systems/Economy/handlers/SlotsHandler";
import { HandleWheel } from "@systems/Economy/handlers/WheelHandler";
import {
  HandleInventory,
  HandleMarketBuy,
  HandleMarketRefresh,
  HandleMarketSell,
  HandleMarketView,
} from "@systems/Economy/handlers/MarketHandler";
import { ITEM_CATALOG } from "@systems/Economy/items";

export const EconomyCommand = CreateCommand({
  name: "economy",
  description: "Check your coins and play economy games",
  group: "fun",
  configure: (builder) => {
    builder
      .addSubcommand((sub) =>
        sub
          .setName("balance")
          .setDescription("Check your coin balance")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User to check (optional)")
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub.setName("daily").setDescription("Claim your daily coins")
      )
      .addSubcommand((sub) =>
        sub
          .setName("flip")
          .setDescription("Flip a coin and optionally bet coins")
          .addIntegerOption((option) =>
            option
              .setName("bet")
              .setDescription("Bet amount (1-1000)")
              .setRequired(false)
              .setMinValue(MIN_BET)
              .setMaxValue(MAX_BET)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("dice")
          .setDescription("Roll a die, optionally bet and guess the number")
          .addIntegerOption((option) =>
            option
              .setName("guess")
              .setDescription("Your guess (1-6)")
              .setMinValue(1)
              .setMaxValue(6)
              .setRequired(false)
          )
          .addIntegerOption((option) =>
            option
              .setName("bet")
              .setDescription("Bet amount (1-1000)")
              .setRequired(false)
              .setMinValue(MIN_BET)
              .setMaxValue(MAX_BET)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("crash")
          .setDescription("Play Crash, cash out before it explodes")
          .addIntegerOption((option) =>
            option
              .setName("bet")
              .setDescription("Bet amount (1-1000)")
              .setRequired(false)
              .setMinValue(MIN_BET)
              .setMaxValue(MAX_BET)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("horserace")
          .setDescription("Bet on a horse and watch the race")
          .addIntegerOption((option) =>
            option
              .setName("bet")
              .setDescription("Bet amount (1-1000)")
              .setRequired(false)
              .setMinValue(MIN_BET)
              .setMaxValue(MAX_BET)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("scratch")
          .setDescription("Play an interactive scratch card")
          .addIntegerOption((option) =>
            option
              .setName("bet")
              .setDescription("Bet amount (1-1000)")
              .setRequired(false)
              .setMinValue(MIN_BET)
              .setMaxValue(MAX_BET)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("slots")
          .setDescription("Spin the slots and test your luck")
          .addIntegerOption((option) =>
            option
              .setName("bet")
              .setDescription("Bet amount (1-1000)")
              .setRequired(false)
              .setMinValue(MIN_BET)
              .setMaxValue(MAX_BET)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("wheel")
          .setDescription("Spin a prize wheel with multipliers")
          .addIntegerOption((option) =>
            option
              .setName("bet")
              .setDescription("Bet amount (1-1000)")
              .setRequired(false)
              .setMinValue(MIN_BET)
              .setMaxValue(MAX_BET)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("blackjack")
          .setDescription("Play blackjack against the dealer")
          .addIntegerOption((option) =>
            option
              .setName("bet")
              .setDescription("Bet amount (1-1000)")
              .setRequired(false)
              .setMinValue(MIN_BET)
              .setMaxValue(MAX_BET)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("rps")
          .setDescription("Play Rock Paper Scissors, optionally bet coins")
          .addIntegerOption((option) =>
            option
              .setName("bet")
              .setDescription("Bet amount (1-1000)")
              .setRequired(false)
              .setMinValue(MIN_BET)
              .setMaxValue(MAX_BET)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("leaderboard")
          .setDescription("View the top coin balances in this server")
      )
      .addSubcommand((sub) =>
        sub
          .setName("gift")
          .setDescription("Send coins to another user")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("The user to gift coins to")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("Amount of coins to send")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(100000)
          )
      )
      .addSubcommandGroup((group) =>
        group
          .setName("market")
          .setDescription("View and trade limited-time items")
          .addSubcommand((sub) =>
            sub
              .setName("view")
              .setDescription("View the current market rotation")
          )
          .addSubcommand((sub) =>
            sub
              .setName("refresh")
              .setDescription("Force refresh the current market rotation")
          )
          .addSubcommand((sub) =>
            sub
              .setName("buy")
              .setDescription("Buy an item from the market")
              .addStringOption((option) => {
                const choices = ITEM_CATALOG.map((item) => ({
                  name: item.name,
                  value: item.id,
                }));
                return option
                  .setName("item")
                  .setDescription("Item to buy")
                  .setRequired(true)
                  .setChoices(...choices);
              })
              .addIntegerOption((option) =>
                option
                  .setName("quantity")
                  .setDescription("Quantity to buy")
                  .setMinValue(1)
                  .setMaxValue(50)
              )
          )
          .addSubcommand((sub) =>
            sub
              .setName("sell")
              .setDescription("Sell an item from your inventory")
              .addStringOption((option) => {
                const choices = ITEM_CATALOG.map((item) => ({
                  name: item.name,
                  value: item.id,
                }));
                return option
                  .setName("item")
                  .setDescription("Item to sell")
                  .setRequired(true)
                  .setChoices(...choices);
              })
              .addIntegerOption((option) =>
                option
                  .setName("quantity")
                  .setDescription("Quantity to sell")
                  .setMinValue(1)
                  .setMaxValue(50)
              )
          )
      )
      .addSubcommand((sub) =>
        sub.setName("inventory").setDescription("View your inventory items")
      );
  },
  config: Config.utility(5),
  execute: async (interaction, context) => {
    if (!interaction.guildId) {
      const embed = EmbedFactory.CreateError({
        title: "Server Only",
        description: "Economy commands can only be used in a server.",
      });

      await context.responders.interactionResponder.Reply(interaction, {
        embeds: [embed.toJSON()],
        ephemeral: true,
      });
      return;
    }

    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand(true);

    if (!subcommandGroup && subcommand === "balance") {
      await HandleBalance(interaction, context);
      return;
    }

    if (!subcommandGroup && subcommand === "daily") {
      await HandleDaily(interaction, context);
      return;
    }

    if (!subcommandGroup && subcommand === "flip") {
      await HandleFlip(interaction, context);
      return;
    }

    if (!subcommandGroup && subcommand === "dice") {
      await HandleDice(interaction, context);
      return;
    }

    if (!subcommandGroup && subcommand === "crash") {
      await HandleCrash(interaction, context);
      return;
    }

    if (!subcommandGroup && subcommand === "horserace") {
      await HandleHorseRace(interaction, context);
      return;
    }

    if (!subcommandGroup && subcommand === "scratch") {
      await HandleScratch(interaction, context);
      return;
    }

    if (!subcommandGroup && subcommand === "slots") {
      await HandleSlots(interaction, context);
      return;
    }

    if (!subcommandGroup && subcommand === "wheel") {
      await HandleWheel(interaction, context);
      return;
    }

    if (!subcommandGroup && subcommand === "blackjack") {
      await HandleBlackjack(interaction, context);
      return;
    }

    if (!subcommandGroup && subcommand === "rps") {
      await HandleRps(interaction, context);
      return;
    }

    if (!subcommandGroup && subcommand === "leaderboard") {
      await HandleLeaderboard(interaction, context);
      return;
    }

    if (!subcommandGroup && subcommand === "gift") {
      await HandleGift(interaction, context);
      return;
    }

    if (subcommandGroup === "market") {
      if (subcommand === "view") {
        await HandleMarketView(interaction, context);
        return;
      }
      if (subcommand === "refresh") {
        await HandleMarketRefresh(interaction, context);
        return;
      }
      if (subcommand === "buy") {
        await HandleMarketBuy(interaction, context);
        return;
      }
      if (subcommand === "sell") {
        await HandleMarketSell(interaction, context);
        return;
      }
    }

    if (!subcommandGroup && subcommand === "inventory") {
      await HandleInventory(interaction, context);
    }
  },
});
