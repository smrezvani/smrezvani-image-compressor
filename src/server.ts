import express, { Request, Response, Application, NextFunction } from "express";
import multer, { Multer } from "multer";
import cors from "cors";
import sharp from "sharp";
import compression from "compression";
import morgan from "morgan";
import {
  CompressRequestBody,
  CompressFileRequestBody,
  InfoRequestBody,
  ImageInfoResponse,
  CompressResponse,
  ErrorResponse,
  HealthResponse,
  SupportedFormat,
  AuthenticatedRequest,
} from "./types";
import { optionalApiKey } from "./middleware/auth";
import logger, { logRequest, logError, logPerformance } from "./utils/logger";

const app: Application = express();

const upload: Multer = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.use(compression());
app.use(cors());

const morganFormat = ':method :url :status :res[content-length] - :response-time ms';
app.use(morgan(morganFormat, {
  stream: {
    write: (message: string) => {
      logger.info(`HTTP ${message.trim()}`);
    }
  }
}));

app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (duration > 5000) {
      logger.warn(`Slow request detected: ${req.method} ${req.url} took ${duration}ms`);
    }
  });
  
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/health", (_req: Request, res: Response<HealthResponse>): void => {
  res.json({ status: "healthy", service: "image-compressor" });
});

app.post(
  "/info",
  optionalApiKey,
  async (
    req: Request<{}, ImageInfoResponse | ErrorResponse, InfoRequestBody>,
    res: Response<ImageInfoResponse | ErrorResponse>
  ): Promise<void> => {
    const startTime = Date.now();
    try {
      logRequest(req);
      const { image } = req.body;
      if (!image) {
        res.status(400).json({ error: "Image data required" });
        return;
      }

      const imageBuffer: Buffer = Buffer.from(image, "base64");
      const metadata = await sharp(imageBuffer).metadata();

      const processingTime = Date.now() - startTime;
      logPerformance('image-info', processingTime, {
        width: metadata.width,
        height: metadata.height
      });

      res.json({
        width: metadata.width || 0,
        height: metadata.height || 0,
      });
    } catch (error) {
      const errorMessage: string =
        error instanceof Error ? error.message : "Unknown error occurred";
      logError(error as Error, { endpoint: '/info' });
      res.status(500).json({ error: errorMessage });
    }
  }
);

app.post(
  "/compress",
  optionalApiKey,
  async (
    req: Request<{}, CompressResponse | ErrorResponse, CompressRequestBody>,
    res: Response<CompressResponse | ErrorResponse>
  ): Promise<void> => {
    const startTime = Date.now();
    let parseTime = 0;
    let sharpTime = 0;
    
    try {
      logRequest(req);
      const {
        image,
        format = "mozjpeg",
        resize = null,
      } = req.body;
      
      const options = req.body.options || {} as Record<string, any>;

      if (!image) {
        res.status(400).json({ error: "Image data required" });
        return;
      }

      const parseStart = Date.now();
      const imageBuffer: Buffer = Buffer.from(image, "base64");
      parseTime = Date.now() - parseStart;
      
      logger.info(`Base64 decode time: ${parseTime}ms for ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB image`);
      
      const sharpStart = Date.now();
      let sharpInstance = sharp(imageBuffer);

      // Apply resize if specified
      if (resize && resize.enabled) {
        const resizeOptions: sharp.ResizeOptions = {};
        
        if (resize.width) resizeOptions.width = resize.width;
        if (resize.height) resizeOptions.height = resize.height;
        
        // Map fitMethod to sharp's fit option
        if (resize.fitMethod) {
          switch (resize.fitMethod) {
            case 'stretch':
              resizeOptions.fit = 'fill';
              break;
            case 'contain':
              resizeOptions.fit = 'inside';
              break;
            default:
              resizeOptions.fit = 'cover';
          }
        }
        
        // Map resize method to sharp's kernel option
        if (resize.method) {
          switch (resize.method) {
            case 'lanczos3':
              resizeOptions.kernel = 'lanczos3';
              break;
            case 'mitchell':
              resizeOptions.kernel = 'mitchell';
              break;
            case 'catrom':
              resizeOptions.kernel = 'cubic';
              break;
            default:
              resizeOptions.kernel = 'lanczos3';
          }
        }
        
        sharpInstance = sharpInstance.resize(resizeOptions);
      }

      // Apply format-specific compression
      let outputBuffer: Buffer;
      let outputFormat: SupportedFormat = format;

      switch (format) {
        case "mozjpeg":
        case "jpeg":
          sharpInstance = sharpInstance.jpeg({
            quality: options.quality || 75,
            progressive: options.progressive !== false,
            mozjpeg: true,
          });
          outputFormat = "mozjpeg";
          break;

        case "webp":
          sharpInstance = sharpInstance.webp({
            quality: options.quality || 75,
            lossless: options.lossless === true,
            nearLossless: options.near_lossless === true,
            smartSubsample: options.use_sharp_yuv !== false,
            effort: options.method || 4,
          });
          break;

        case "avif":
          sharpInstance = sharpInstance.avif({
            quality: options.quality || 50,
            lossless: options.lossless === true,
            effort: options.effort || 4,
          });
          break;

        case "oxipng":
        case "png":
          sharpInstance = sharpInstance.png({
            compressionLevel: options.level || 2,
            progressive: options.interlace === true,
            effort: options.effort || 7,
          });
          outputFormat = "oxipng";
          break;

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      outputBuffer = await sharpInstance.toBuffer();
      sharpTime = Date.now() - sharpStart;
      
      logger.info(`Sharp processing time: ${sharpTime}ms`);
      
      const encodeStart = Date.now();
      const base64: string = outputBuffer.toString("base64");
      const encodeTime = Date.now() - encodeStart;
      
      logger.info(`Base64 encode time: ${encodeTime}ms`);

      const totalTime = Date.now() - startTime;
      
      logPerformance('compress', totalTime, {
        format: outputFormat,
        inputSize: imageBuffer.length,
        outputSize: outputBuffer.length,
        compressionRatio: ((1 - outputBuffer.length / imageBuffer.length) * 100).toFixed(1) + '%',
        parseTime,
        sharpTime,
        totalTime
      });
      
      res.json({
        image: base64,
        size: outputBuffer.length,
        format: outputFormat,
      });
    } catch (error) {
      const errorMessage: string =
        error instanceof Error ? error.message : "Unknown error occurred";
      logError(error as Error, { 
        endpoint: '/compress',
        format: req.body.format,
        hasResize: !!req.body.resize?.enabled
      });
      res.status(500).json({ error: errorMessage });
    }
  }
);

interface MulterRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

app.post(
  "/compress/file",
  optionalApiKey,
  upload.single("image"),
  async (req: MulterRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    try {
      logRequest(req);
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const body = req.body as CompressFileRequestBody;
      const format: SupportedFormat =
        (body.format as SupportedFormat) || "mozjpeg";

      let options: Record<string, any> = {};
      if (body.options) {
        try {
          options = JSON.parse(body.options);
        } catch {
          res.status(400).json({ error: "Invalid options JSON" });
          return;
        }
      }

      let sharpInstance = sharp(req.file.buffer);
      let outputBuffer: Buffer;
      let contentType: string;

      switch (format) {
        case "mozjpeg":
        case "jpeg":
          sharpInstance = sharpInstance.jpeg({
            quality: options.quality || 75,
            progressive: options.progressive !== false,
            mozjpeg: true,
          });
          contentType = "image/jpeg";
          break;

        case "webp":
          sharpInstance = sharpInstance.webp({
            quality: options.quality || 75,
            lossless: options.lossless === true,
            nearLossless: options.near_lossless === true,
            smartSubsample: options.use_sharp_yuv !== false,
            effort: options.method || 4,
          });
          contentType = "image/webp";
          break;

        case "avif":
          sharpInstance = sharpInstance.avif({
            quality: options.quality || 50,
            lossless: options.lossless === true,
            effort: options.effort || 4,
          });
          contentType = "image/avif";
          break;

        case "oxipng":
        case "png":
          sharpInstance = sharpInstance.png({
            compressionLevel: options.level || 2,
            progressive: options.interlace === true,
            effort: options.effort || 7,
          });
          contentType = "image/png";
          break;

        default:
          res.status(400).json({ error: `Unsupported format: ${format}` });
          return;
      }

      outputBuffer = await sharpInstance.toBuffer();

      const totalTime = Date.now() - startTime;
      
      logPerformance('compress-file', totalTime, {
        format: format,
        inputSize: req.file.buffer.length,
        outputSize: outputBuffer.length,
        compressionRatio: ((1 - outputBuffer.length / req.file.buffer.length) * 100).toFixed(1) + '%'
      });

      res.set({
        "Content-Type": contentType,
        "Content-Length": outputBuffer.length.toString(),
      });

      res.send(outputBuffer);
    } catch (error) {
      const errorMessage: string =
        error instanceof Error ? error.message : "Unknown error occurred";
      logError(error as Error, { endpoint: '/compress/file' });
      res.status(500).json({ error: errorMessage });
    }
  }
);

const PORT: number = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, (): void => {
  logger.info(`Image Compressor API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Authentication: ${process.env.ENABLE_AUTH === "true" ? 'Enabled' : 'Disabled'}`);
  logger.info(`Log level: ${process.env.LOG_LEVEL || 'info'}`);
  
  console.log(`Image Compressor API server running on port ${PORT}`);
  if (process.env.ENABLE_AUTH === "true") {
    console.log("API key authentication is enabled");
  }
});

process.on("SIGINT", async (): Promise<void> => {
  logger.info('Server shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (error: Error) => {
  logError(error, { type: 'uncaughtException' });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection', { reason, promise });
});