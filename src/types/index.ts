import { Request } from 'express';

export interface ImageFormat {
  mozjpeg: MozJpegOptions;
  webp: WebPOptions;
  avif: AvifOptions;
  oxipng: OxiPngOptions;
  jxl: JxlOptions;
}

export interface MozJpegOptions {
  quality?: number;
  baseline?: boolean;
  arithmetic?: boolean;
  progressive?: boolean;
  optimize_coding?: boolean;
  smoothing?: number;
  color_space?: number;
  quant_table?: number;
  trellis_multipass?: boolean;
  trellis_opt_zero?: boolean;
  trellis_opt_table?: boolean;
  trellis_loops?: number;
  auto_subsample?: boolean;
  chroma_subsample?: number;
  separate_chroma_quality?: boolean;
  chroma_quality?: number;
}

export interface WebPOptions {
  quality?: number;
  target_size?: number;
  target_PSNR?: number;
  method?: number;
  sns_strength?: number;
  filter_strength?: number;
  filter_sharpness?: number;
  filter_type?: number;
  partitions?: number;
  segments?: number;
  pass?: number;
  show_compressed?: number;
  preprocessing?: number;
  autofilter?: number;
  partition_limit?: number;
  alpha_compression?: number;
  alpha_filtering?: number;
  alpha_quality?: number;
  lossless?: number;
  exact?: number;
  image_hint?: number;
  emulate_jpeg_size?: number;
  thread_level?: number;
  low_memory?: number;
  near_lossless?: number;
  use_delta_palette?: number;
  use_sharp_yuv?: number;
}

export interface AvifOptions {
  quality?: number;
  qualityAlpha?: number;
  subsample?: number;
  effort?: number;
  chromaDeltaQ?: boolean;
  sharpness?: number;
  denoiseLevel?: number;
  tune?: number;
}

export interface OxiPngOptions {
  level?: number;
  interlace?: boolean;
}

export interface JxlOptions {
  quality?: number;
  progressive?: boolean;
  epf?: number;
  effort?: number;
  photonNoiseIso?: number;
  lossyModular?: boolean;
}

export type SupportedFormat = keyof ImageFormat | "jpeg" | "png";

export interface ResizeOptions {
  enabled: boolean;
  width?: number;
  height?: number;
  method?: 'triangle' | 'catrom' | 'mitchell' | 'lanczos3';
  fitMethod?: 'stretch' | 'contain';
  premultiply?: boolean;
  linearRGB?: boolean;
}

export interface PreprocessOptions {
  resize?: ResizeOptions;
  rotate?: {
    numRotations: number;
  };
  quant?: {
    enabled: boolean;
    numColors?: number;
    dither?: number;
  };
}

export interface CompressRequestBody {
  image: string;
  format?: SupportedFormat;
  options?: Record<string, any>;
  resize?: ResizeOptions | null;
  preprocess?: PreprocessOptions;
}

export interface CompressFileRequestBody {
  format?: SupportedFormat;
  options?: string;
}

export interface InfoRequestBody {
  image: string;
}

export interface ImageInfoResponse {
  width: number;
  height: number;
}

export interface CompressResponse {
  image: string;
  size: number;
  format: SupportedFormat;
}

export interface ErrorResponse {
  error: string;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
}

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
}

export interface EncodedImage {
  binary: Buffer;
  extension: string;
}

export interface DecodedImage {
  bitmap: {
    width: number;
    height: number;
    data: Uint8Array;
  };
}

export type ContentTypeMap = {
  [K in SupportedFormat]: string;
};

export interface EncodeOptionsMap {
  [key: string]: Record<string, unknown>;
}