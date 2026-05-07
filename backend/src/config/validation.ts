import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().required(),

  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),

  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_MODEL_DEFAULT: Joi.string().default('gpt-4o-mini'),
  OPENAI_MODEL_ADVANCED: Joi.string().default('gpt-4o'),
  OPENAI_MODEL_VISION: Joi.string().default('gpt-4o'),

  AI_HARD_DAILY_TENANT_USD: Joi.number().default(20),

  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),

  AWS_REGION: Joi.string().default('eu-west-3'),
  S3_BUCKET: Joi.string().required(),
});
