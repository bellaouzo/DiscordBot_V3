# 📚 Code Examples

This folder contains practical examples of how to use the Discord Bot V3 framework.

## 🚀 Quick Start

**New to the framework?** Start here:

1. **[Starter Template](basic/starter-template.ts)** - 🟢 **Beginner** - Complete working command you can copy and run immediately
2. Copy it to `src/Commands/utility/your-command.ts`
3. Modify the name, description, and logic
4. Run `npm run dev` and test it!

## 📁 Available Examples

### 🟢 Beginner Level

- **[Starter Template](basic/starter-template.ts)** - Complete working command template
- **[Ping Command](basic/ping-command.ts)** - Simple command with action responder
- **[Hello Command](basic/hello-command.ts)** - Basic reply command
- **[Ready Event](events/ready-event.ts)** - Bot startup event

### 🟡 Intermediate Level

- **[Kick Command](advanced/kick-command.ts)** - Moderation command with options and permissions
- **[Embed Factory](utilities/embed-examples.ts)** - Creating rich embeds
- **[Component Factory](utilities/component-examples.ts)** - Building interactive components
- **[Guild Resource Locator](utilities/guild-resource-examples.ts)** - Fetching guild channels, roles, and members

### 🔴 Advanced Level

- **[Help Command](advanced/help-command.ts)** - Interactive command with pagination and buttons

## 🎯 What Each Example Teaches

| Example | Teaches | Key Features |
|---------|---------|--------------|
| **Starter Template** | Basic command structure | Complete working example, middleware, logging |
| **Ping Command** | Action responders | `WithAction`, loading states, follow-ups |
| **Hello Command** | Simple replies | `Reply`, basic logging, user interaction |
| **Kick Command** | Command options | User/string/boolean options, permissions, DM sending |
| **Help Command** | Pagination system | `PaginatedResponder`, caching, component routing |
| **Ready Event** | Event handling | Bot startup, activity setting, logging |
| **Embed Factory** | Rich embeds | Success/warning/error embeds, help sections |
| **Component Factory** | Interactive UI | Buttons, action rows, pagination controls |
| **Guild Resources** | Server data access | Channel/role/member fetching, caching |

## 📝 How to Use Examples

### Copy-Paste Instructions

1. **Choose an example** that matches what you want to build
2. **Copy the entire file** to your `src/Commands/` directory
3. **Update the command name** and description
4. **Modify the logic** to fit your needs
5. **Run `npm run dev`** to test your command

### Example Workflow

```bash
# 1. Copy starter template
cp examples/basic/starter-template.ts src/Commands/utility/my-command.ts

# 2. Edit the file
# - Change name from "starter-template" to "my-command"
# - Update description
# - Modify the execute function

# 3. Test it
npm run dev
```

## 🔧 Troubleshooting Examples

**Import errors:**
- Make sure you're copying to the correct directory structure
- Check that all imports use the correct paths (`../../src/...`)

**Command not working:**
- Verify the command name is unique
- Check that middleware is properly configured
- Look at console logs for error messages

**TypeScript errors:**
- Ensure you're using the correct API methods
- Check the main README for API reference
- Compare with working examples

## 💡 Tips for Learning

1. **Start with the Starter Template** - it has everything you need
2. **Read the comments** - each example is heavily documented
3. **Try uncommenting code** - many examples have commented sections to explore
4. **Modify gradually** - change one thing at a time to understand what breaks
5. **Check the main README** - it has the complete API reference

## 🎨 Customizing Examples

All examples follow the same patterns:

```typescript
// 1. Import what you need
import { CommandContext, CreateCommand } from "../../src/Commands";

// 2. Write your execute function
async function ExecuteMyCommand(interaction, context) {
  const { interactionResponder } = context.responders;
  // Your logic here
}

// 3. Export the command
export const MyCommand = CreateCommand({
  name: "my-command",
  description: "My awesome command",
  group: "utility",
  middleware: { /* ... */ },
  execute: ExecuteMyCommand,
});
```

## 📚 Next Steps

After trying the examples:

1. **Read the main README** for complete documentation
2. **Check the API Reference** for all available methods
3. **Explore the source code** in `src/` to understand the framework
4. **Join the community** for help and sharing your creations!

---

**Happy coding!** 🚀
