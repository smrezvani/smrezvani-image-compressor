import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

const API_KEY = process.env.API_KEY || 'your-secure-api-key-here';

export function validateApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({ error: 'API key is required' });
    return;
  }

  if (apiKey !== API_KEY) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  req.apiKey = apiKey;
  next();
}

export function optionalApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const enableAuth = process.env.ENABLE_AUTH === 'true';
  
  if (!enableAuth) {
    next();
    return;
  }

  validateApiKey(req, res, next);
}