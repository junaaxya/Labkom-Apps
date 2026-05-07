import { Request, Response, NextFunction } from "express";

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error(`[Error] ${statusCode} - ${message}`);

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const error: AppError = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};
