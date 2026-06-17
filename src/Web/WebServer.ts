import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
// @ts-expect-error No type definitions available for this module
import SQLiteStoreFactory from "better-sqlite3-session-store";
import { join } from "path";
import type { Server } from "http";
import type { AppConfig } from "@config/AppConfig";
import type { Logger } from "@shared/Logger";
import type { Client } from "discord.js";
import type { DatabaseSet } from "@database";
import { createAuthRouter } from "./routes/auth";
import { createApiRouter } from "./routes/api";

export class WebServer {
  private readonly app = express();
  private server: Server | null = null;

  constructor(
    private readonly client: Client,
    private readonly config: AppConfig,
    private readonly databases: DatabaseSet,
    private readonly logger: Logger,
  ) {
    this.Configure();
    this.SetupRoutes();
  }

  private Configure(): void {
    const SqliteStore = SQLiteStoreFactory(session);

    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    this.app.use(
      session({
        store: new SqliteStore({
          client: this.databases.userDb.Db,
          expired: {
            clear: true,
            intervalMs: 900000, // 15min
          },
        }),
        secret: this.config.web.sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
          maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        },
      }),
    );

    this.app.use(passport.initialize());
    this.app.use(passport.session());

    passport.serializeUser((user, done) => {
      done(null, user);
    });

    passport.deserializeUser((obj, done) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      done(null, obj as any);
    });

    passport.use(
      new DiscordStrategy(
        {
          clientID: this.config.deployment.clientId,
          clientSecret: this.config.web.clientSecret,
          callbackURL: this.config.web.oauthRedirectUri,
          scope: ["identify", "guilds"],
        },
        (_accessToken, _refreshToken, profile, done) => {
          return done(null, profile);
        },
      ),
    );

    // Serve static files from the public directory
    this.app.use(express.static(join(__dirname, "public")));
  }

  private SetupRoutes(): void {
    // Mount routers
    this.app.use("/auth", createAuthRouter());
    this.app.use("/api", createApiRouter(this.client, this.databases));

    // Protected dashboard route (fallback if they hit /dashboard directly without JS doing it)
    this.app.get("/dashboard", (req, res) => {
      if (!req.isAuthenticated()) {
        res.redirect("/");
        return;
      }
      res.sendFile(join(__dirname, "public", "dashboard.html"));
    });
  }

  public Start(): void {
    const port = this.config.web.port;
    this.server = this.app.listen(port, () => {
      this.logger.Info(`Web server listening on port ${port}`, {
        phase: "web",
      });
    });
  }

  public Stop(): void {
    if (this.server) {
      this.server.close((err) => {
        if (err) {
          this.logger.Error("Error closing web server", {
            error: err,
            phase: "web",
          });
        } else {
          this.logger.Info("Web server closed", { phase: "web" });
        }
      });
    }
  }
}
