// Fake live log for the Console mockup. Swap FAKE_EVENTS for a real
// websocket / SSE feed from CommandLogStore when this becomes a real page.

const FAKE_EVENTS = [
  ["info", "/rank invoked by <u>junebug</u> in #general (31ms)"],
  ["info", "/economy work by <u>orbit</u> +120 coins"],
  ["info", "/poll create by <u>Theo</u> \"Next game night?\""],
  ["warn", "spam-filter flagged <u>newbie42</u> (5 msgs / 3s)"],
  ["cd", "/trivia by <u>quill</u> on cooldown 12s"],
  ["info", "/leaderboard by <u>mossy</u> page=1"],
  ["err", "/ban by <u>fern</u>, missing BanMembers"],
  ["info", "level-up: <u>tamarind</u> reached Lv 38"],
  ["info", "/giveaway enter by <u>pebble</u> \"Nitro Classic\""],
  ["warn", "link-filter removed message from <u>driftwood</u>"],
];

const LABELS = { info: "INFO", warn: "WARN", err: "DENY", cd: "COOL" };
const MAX_LINES = 14;

const stream = document.getElementById("log-stream");

function timestamp() {
  return new Date().toTimeString().slice(0, 8);
}

function pushLine() {
  const [level, text] = FAKE_EVENTS[Math.floor(Math.random() * FAKE_EVENTS.length)];
  const li = document.createElement("li");
  li.innerHTML = `<time>${timestamp()}</time><b class="lvl ${level}">${LABELS[level]}</b> ${text}`;
  stream.prepend(li);

  while (stream.children.length > MAX_LINES) {
    stream.lastElementChild.remove();
  }
}

if (stream && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  setInterval(pushLine, 2200);
}
