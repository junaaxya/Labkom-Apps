import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import path from "path";
import { config } from "./config";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import routes from "./routes";

const app = express();

// Security middleware
app.use(helmet());

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

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/v1", routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
