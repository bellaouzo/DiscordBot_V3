export type RandomSource = () => number;

export interface WorkTask {
  readonly job: string;
  readonly emoji: string;
  readonly prompt: string;
  /** Four answer labels, shuffled. */
  readonly options: readonly string[];
  readonly correctIndex: number;
}

const STREETS = ["maple", "harbor", "willow", "summit", "canyon", "meadow"];
const GENRES = [
  "mystery",
  "fantasy",
  "history",
  "romance",
  "poetry",
  "science",
];

function RandomInt(random: RandomSource, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function Pick<T>(random: RandomSource, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function Shuffle<T>(random: RandomSource, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Scrambles a word, guaranteeing the result differs from the original. */
export function ScrambleWord(random: RandomSource, word: string): string {
  const letters = word.split("");
  for (let attempt = 0; attempt < 10; attempt++) {
    const scrambled = Shuffle(random, letters).join("");
    if (scrambled !== word) {
      return scrambled;
    }
  }
  return word.slice(1) + word[0];
}

/** Three distinct, non-negative wrong answers near the correct one. */
function NumberDistractors(random: RandomSource, answer: number): number[] {
  const distractors = new Set<number>();
  let spread = Math.max(3, Math.round(answer * 0.25));
  while (distractors.size < 3) {
    const offset = RandomInt(random, 1, spread) * (random() < 0.5 ? -1 : 1);
    const candidate = answer + offset;
    if (candidate >= 0 && candidate !== answer) {
      distractors.add(candidate);
    }
    spread += 1;
  }
  return [...distractors];
}

function BuildTask(
  random: RandomSource,
  base: { job: string; emoji: string; prompt: string },
  answer: string,
  distractors: readonly string[],
): WorkTask {
  const options = Shuffle(random, [answer, ...distractors.slice(0, 3)]);
  return { ...base, options, correctIndex: options.indexOf(answer) };
}

function NumberTask(
  random: RandomSource,
  base: { job: string; emoji: string; prompt: string },
  answer: number,
): WorkTask {
  return BuildTask(
    random,
    base,
    String(answer),
    NumberDistractors(random, answer).map(String),
  );
}

function WordTask(
  random: RandomSource,
  base: { job: string; emoji: string },
  words: readonly string[],
  label: string,
): WorkTask {
  const answer = Pick(random, words);
  const distractors = Shuffle(
    random,
    words.filter((word) => word !== answer),
  );
  return BuildTask(
    random,
    {
      ...base,
      prompt: `Unscramble the ${label}: **${ScrambleWord(random, answer).toUpperCase()}**`,
    },
    answer,
    distractors,
  );
}

const TASK_GENERATORS: ReadonlyArray<(random: RandomSource) => WorkTask> = [
  (random) => {
    const count = RandomInt(random, 2, 9);
    const price = RandomInt(random, 3, 12);
    return NumberTask(
      random,
      {
        job: "Barista",
        emoji: "☕",
        prompt: `An order has **${count}** lattes at **${price}** coins each. What's the total?`,
      },
      count * price,
    );
  },
  (random) => {
    const total = RandomInt(random, 11, 89);
    const paid = (Math.floor(total / 20) + 1) * 20 + (random() < 0.5 ? 0 : 50);
    return NumberTask(
      random,
      {
        job: "Cashier",
        emoji: "🧾",
        prompt: `The bill is **${total}** coins and the customer pays **${paid}**. How much change?`,
      },
      paid - total,
    );
  },
  (random) => {
    const a = RandomInt(random, 2, 20);
    const b = RandomInt(random, 2, 9);
    const c = RandomInt(random, 2, 9);
    return NumberTask(
      random,
      {
        job: "Programmer",
        emoji: "💻",
        prompt: `What does \`${a} + ${b} * ${c}\` evaluate to?`,
      },
      a + b * c,
    );
  },
  (random) => {
    const rows = RandomInt(random, 3, 9);
    const perRow = RandomInt(random, 4, 12);
    const failed = RandomInt(random, 1, rows);
    return NumberTask(
      random,
      {
        job: "Gardener",
        emoji: "🌱",
        prompt: `You plant **${rows}** rows of **${perRow}** seeds, and **${failed}** don't sprout. How many grow?`,
      },
      rows * perRow - failed,
    );
  },
  (random) =>
    WordTask(random, { job: "Courier", emoji: "📦" }, STREETS, "street name"),
  (random) =>
    WordTask(random, { job: "Librarian", emoji: "📚" }, GENRES, "book genre"),
];

export function GenerateWorkTask(random: RandomSource = Math.random): WorkTask {
  return Pick(random, TASK_GENERATORS)(random);
}

export function RollWorkReward(
  random: RandomSource,
  min: number,
  max: number,
): number {
  return RandomInt(random, min, max);
}
