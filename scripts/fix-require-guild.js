const fs = require("fs");
const path = require("path");

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(filePath);
    } else if (entry.name.endsWith(".ts")) {
      fixFile(filePath);
    }
  }
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  if (
    !content.includes("interaction.guildId!") &&
    !content.includes("interaction.guild!")
  ) {
    return;
  }

  content = content.replace(
    /interaction\.guildId!/g,
    "RequireGuild(interaction).id",
  );
  content = content.replace(/interaction\.guild!/g, "RequireGuild(interaction)");

  if (!content.includes("RequireGuild")) {
    return;
  }

  if (!/import\s*\{[^}]*RequireGuild/.test(content)) {
    const utilitiesImport = content.match(
      /import\s*\{([^}]+)\}\s*from\s*"@utilities"/,
    );
    if (utilitiesImport) {
      content = content.replace(
        /import\s*\{([^}]+)\}\s*from\s*"@utilities"/,
        (_, imports) => {
          if (imports.includes("RequireGuild")) {
            return `import {${imports}} from "@utilities"`;
          }
          return `import { RequireGuild, ${imports.trim()} } from "@utilities"`;
        },
      );
    } else {
      content = `import { RequireGuild } from "@utilities";\n${content}`;
    }
  }

  fs.writeFileSync(filePath, content);
}

walk(path.join(__dirname, "..", "src"));
