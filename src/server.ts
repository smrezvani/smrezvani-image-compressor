import express, { Request, Response, Application } from "express";
import multer, { Multer } from "multer";
import cors from "cors";
import sharp from "sharp";
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

const app: Application = express();

const upload: Multer = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/health", (_req: Request, res: Response<HealthResponse>): void => {
  res.json({ status: "healthy", service: "image-compressor" });
});

app.post(
  "/info",
  optionalApiKey,
  express.json(),
  async (
    req: Request<{}, ImageInfoResponse | ErrorResponse, InfoRequestBody>,
    res: Response<ImageInfoResponse | ErrorResponse>
  ): Promise<void> => {
    try {
      const { image } = req.body;
      if (!image) {
        res.status(400).json({ error: "Image data required" });
        return;
      }

      const imageBuffer: Buffer = Buffer.from(image, "base64");
      const metadata = await sharp(imageBuffer).metadata();

      res.json({
        width: metadata.width || 0,
        height: metadata.height || 0,
      });
    } catch (error) {
      const errorMessage: string =
        error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({ error: errorMessage });
    }
  }
);

app.post(
  "/compress",
  optionalApiKey,
  express.json(),
  async (
    req: Request<{}, CompressResponse | ErrorResponse, CompressRequestBody>,
    res: Response<CompressResponse | ErrorResponse>
  ): Promise<void> => {
    try {
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

      const imageBuffer: Buffer = Buffer.from(image, "base64");
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
      const base64: string = outputBuffer.toString("base64");

      res.json({
        image: base64,
        size: outputBuffer.length,
        format: outputFormat,
      });
    } catch (error) {
      const errorMessage: string =
        error instanceof Error ? error.message : "Unknown error occurred";
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
    try {
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

      res.set({
        "Content-Type": contentType,
        "Content-Length": outputBuffer.length.toString(),
      });

      res.send(outputBuffer);
    } catch (error) {
      const errorMessage: string =
        error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({ error: errorMessage });
    }
  }
);

const PORT: number = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, (): void => {
  console.log(`Image Compressor API server running on port ${PORT}`);
  if (process.env.ENABLE_AUTH === "true") {
    console.log("API key authentication is enabled");
  }
});

process.on("SIGINT", async (): Promise<void> => {
  process.exit(0);
});