import type { SlashCommandSubcommandBuilder } from "discord.js";
import { CreateCommand } from "@commands";
import { Config } from "@middleware";
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
import {
  HandleDuelCancel,
  HandleDuelChallenge,
} from "@systems/Economy/handlers/DuelHandler";
import {
  HandleLotteryCreate,
  HandleLotteryList,
} from "@systems/Economy/handlers/LotteryHandler";
import { ReplyWithFeatureAbout } from "@commands/Utility/FeatureAbout";

/** The optional "bet" option shared by every single-player game. */
function AddBetOption(sub: SlashCommandSubcommandBuilder): void {
  sub.addIntegerOption((option) =>
    option
      .setName("bet")
      .setDescription("Bet amount (1-1000)")
      .setRequired(false)
      .setMinValue(MIN_BET)
      .setMaxValue(MAX_BET),
  );
}

function AddMarketItemOptions(
  sub: SlashCommandSubcommandBuilder,
  verb: "buy" | "sell",
): void {
  sub
    .addStringOption((option) =>
      option
        .setName("item")
        .setDescription(`Item to ${verb}`)
        .setRequired(true)
        .setChoices(
          ...ITEM_CATALOG.map((item) => ({ name: item.name, value: item.id })),
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName("quantity")
        .setDescription(`Quantity to ${verb}`)
        .setMinValue(1)
        .setMaxValue(50),
    );
}

export const EconomyCommand = CreateCommand({
  name: "economy",
  description: "Check your coins and play economy games",
  group: "fun",
  config: Config.utilityWithFeature("economy", 5),
  subcommands: [
    {
      name: "balance",
      description: "Check your coin balance",
      options: (sub) =>
        sub.addUserOption((option) =>
          option
            .setName("user")
            .setDescription("User to check (optional)")
            .setRequired(false),
        ),
      execute: HandleBalance,
    },
    {
      name: "daily",
      description: "Claim your daily coins",
      execute: HandleDaily,
    },
    {
      name: "flip",
      description: "Flip a coin and optionally bet coins",
      options: AddBetOption,
      execute: HandleFlip,
    },
    {
      name: "dice",
      description: "Roll a die, optionally bet and guess the number",
      options: (sub) => {
        sub.addIntegerOption((option) =>
          option
            .setName("guess")
            .setDescription("Your guess (1-6)")
            .setMinValue(1)
            .setMaxValue(6)
            .setRequired(false),
        );
        AddBetOption(sub);
      },
      execute: HandleDice,
    },
    {
      name: "crash",
      description: "Play Crash, cash out before it explodes",
      options: AddBetOption,
      execute: HandleCrash,
    },
    {
      name: "horserace",
      description: "Bet on a horse and watch the race",
      options: AddBetOption,
      execute: HandleHorseRace,
    },
    {
      name: "scratch",
      description: "Play an interactive scratch card",
      options: AddBetOption,
      execute: HandleScratch,
    },
    {
      name: "slots",
      description: "Spin the slots and test your luck",
      options: AddBetOption,
      execute: HandleSlots,
    },
    {
      name: "wheel",
      description: "Spin a prize wheel with multipliers",
      options: AddBetOption,
      execute: HandleWheel,
    },
    {
      name: "blackjack",
      description: "Play blackjack against the dealer",
      options: AddBetOption,
      execute: HandleBlackjack,
    },
    {
      name: "rps",
      description: "Play Rock Paper Scissors, optionally bet coins",
      options: AddBetOption,
      execute: HandleRps,
    },
    {
      name: "leaderboard",
      description: "View the top coin balances in this server",
      execute: HandleLeaderboard,
    },
    {
      name: "gift",
      description: "Send coins to another user",
      options: (sub) =>
        sub
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("The user to gift coins to")
              .setRequired(true),
          )
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("Amount of coins to send")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(100000),
          ),
      execute: HandleGift,
    },
    {
      name: "market",
      description: "View and trade limited-time items",
      subcommands: [
        {
          name: "view",
          description: "View the current market rotation",
          execute: HandleMarketView,
        },
        {
          name: "refresh",
          description: "Force refresh the current market rotation",
          execute: HandleMarketRefresh,
        },
        {
          name: "buy",
          description: "Buy an item from the market",
          options: (sub) => AddMarketItemOptions(sub, "buy"),
          execute: HandleMarketBuy,
        },
        {
          name: "sell",
          description: "Sell an item from your inventory",
          options: (sub) => AddMarketItemOptions(sub, "sell"),
          execute: HandleMarketSell,
        },
      ],
    },
    {
      name: "inventory",
      description: "View your inventory items",
      execute: HandleInventory,
    },
    {
      name: "duel",
      description: "Challenge another player to a coin duel",
      subcommands: [
        {
          name: "challenge",
          description: "Challenge a user to a duel",
          options: (sub) =>
            sub
              .addUserOption((option) =>
                option
                  .setName("user")
                  .setDescription("Opponent")
                  .setRequired(true),
              )
              .addIntegerOption((option) =>
                option
                  .setName("bet")
                  .setDescription("Bet amount per player")
                  .setRequired(true)
                  .setMinValue(MIN_BET)
                  .setMaxValue(MAX_BET),
              )
              .addStringOption((option) =>
                option
                  .setName("game")
                  .setDescription("Duel game type")
                  .setRequired(true)
                  .addChoices(
                    { name: "Coinflip", value: "flip" },
                    { name: "Rock Paper Scissors", value: "rps" },
                  ),
              ),
          execute: HandleDuelChallenge,
        },
        {
          name: "cancel",
          description: "Cancel your oldest pending duel challenge",
          execute: HandleDuelCancel,
        },
      ],
    },
    {
      name: "lottery",
      description: "Server coin lotteries",
      subcommands: [
        {
          name: "create",
          description: "Create a server lottery (moderator)",
          options: (sub) =>
            sub
              .addIntegerOption((option) =>
                option
                  .setName("entry-cost")
                  .setDescription("Cost in coins to enter")
                  .setRequired(true)
                  .setMinValue(1)
                  .setMaxValue(1000),
              )
              .addStringOption((option) =>
                option
                  .setName("duration")
                  .setDescription("How long entries stay open (e.g. 1h)")
                  .setRequired(true),
              ),
          execute: HandleLotteryCreate,
        },
        {
          name: "list",
          description: "List active lotteries",
          execute: HandleLotteryList,
        },
      ],
    },
    {
      name: "about",
      description: "Learn how the server economy works",
      execute: (interaction, context) =>
        ReplyWithFeatureAbout(interaction, context, "economy"),
    },
  ],
});
