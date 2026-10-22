import express from "express";
import session from "express-session";
import passport from "passport";
import {
  Strategy as DiscordStrategy,
  DiscordScope,
  type ConsumableAPI,
  type DiscordProfile,
  type VerifyCallback,
} from "discord-strategy";
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

    // Behind Caddy/nginx: trust the first proxy hop so req.secure reflects HTTPS
    if (this.config.web.trustProxy) {
      this.app.set("trust proxy", 1);
    }

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
          httpOnly: true,
          sameSite: "lax",
          secure: "auto", // secure when the request arrived over HTTPS
        },
      }),
    );

    this.app.use(passport.initialize());
    this.app.use(passport.session());

    passport.serializeUser((user, done) => {
      done(null, user);
    });

    passport.deserializeUser((obj, done) => {
      done(null, obj as Express.User);
    });

    passport.use(
      new DiscordStrategy(
        {
          clientID: this.config.deployment.clientId,
          clientSecret: this.config.web.clientSecret,
          callbackURL: this.config.web.oauthRedirectUri,
          authorizationURL: "https://discord.com/api/oauth2/authorize",
          tokenURL: "https://discord.com/api/oauth2/token",
          scope: [DiscordScope.Identify, DiscordScope.Guilds],
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: DiscordProfile,
          done: VerifyCallback,
          consume: ConsumableAPI,
        ) => {
          try {
            await consume.guilds();
            done(null, profile);
          } catch (error) {
            done(error instanceof Error ? error : new Error(String(error)));
          }
        },
      ),
    );

    // Serve static files from the public directory
    this.app.use(express.static(join(__dirname, "public")));
  }

  private SetupRoutes(): void {
    // Unauthenticated liveness probe for uptime checks and deploy scripts
    this.app.get("/api/health", (_req, res) => {
      const ready = this.client.isReady();
      res.status(ready ? 200 : 503).json({
        status: ready ? "ok" : "starting",
        uptimeSeconds: Math.round(process.uptime()),
        gatewayPingMs: ready ? this.client.ws.ping : null,
        guilds: ready ? this.client.guilds.cache.size : 0,
      });
    });

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
    const { port, host } = this.config.web;
    const onListening = (): void => {
      this.logger.Info(`Web server listening on ${host ?? "*"}:${port}`, {
        phase: "web",
      });
    };
    this.server = host
      ? this.app.listen(port, host, onListening)
      : this.app.listen(port, onListening);
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
