import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { config } from "./config";
import { ensureUploadDirectories, getUploadCategoryDir } from "./config/upload";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import routes from "./routes";

const app = express();

ensureUploadDirectories();

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// Compression
app.use(compression());

// CORS
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging
if (config.nodeEnv === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

app.use(
  "/uploads/avatars",
  express.static(getUploadCategoryDir("avatars"), {
    dotfiles: "deny",
    index: false,
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

app.use("/api/v1", routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
