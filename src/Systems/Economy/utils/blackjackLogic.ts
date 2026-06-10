import type { CardValue } from "@systems/Economy/types";

export const BJ_DECK: CardValue[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export function createShuffledDeck(): CardValue[] {
  const cards: CardValue[] = [];
  for (let i = 0; i < 4; i++) {
    cards.push(...BJ_DECK);
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function drawCard(deck: CardValue[]): CardValue {
  const card = deck.pop();
  if (!card) {
    throw new Error("Deck is empty");
  }
  return card;
}

export function handValue(cards: CardValue[]): number {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card === "A") {
      aces += 1;
      total += 11;
    } else if (["K", "Q", "J"].includes(card)) {
      total += 10;
    } else {
      total += parseInt(card, 10);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

export function isBlackjack(cards: CardValue[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}
