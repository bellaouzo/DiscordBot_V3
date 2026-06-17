import { Router } from "express";
import passport from "passport";

export function createAuthRouter(): Router {
  const router = Router();

  router.get("/discord", passport.authenticate("discord"));

  router.get(
    "/discord/callback",
    passport.authenticate("discord", {
      failureRedirect: "/",
    }),
    (_req, res) => {
      res.redirect("/dashboard");
    },
  );

  router.get("/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.redirect("/");
    });
  });

  return router;
}
