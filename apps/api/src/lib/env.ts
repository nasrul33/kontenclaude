import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_URL: z.string().url().default('http://localhost:3000'),
  // Public origin of THIS api (where Better Auth endpoints are served).
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  MINIO_ENDPOINT: z.string().min(1).default('localhost:9000'),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET_SOURCES: z.string().min(1).default('clipflow-sources'),
  MINIO_BUCKET_CLIPS: z.string().min(1).default('clipflow-clips'),
  MINIO_BUCKET_SRT: z.string().min(1).default('clipflow-srt'),
  MINIO_BUCKET_THUMBS: z.string().min(1).default('clipflow-thumbnails'),

  // 32 bytes hex = 64 chars.
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'must be 64 hex chars (32 bytes)'),
  SESSION_COOKIE_SECRET: z.string().min(16),

  // AI provider for segment picker + caption gen. Default Claude (per CLAUDE.md);
  // set AI_PROVIDER=openai to run on OpenAI instead.
  AI_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
}).superRefine((env, ctx) => {
  if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['OPENAI_API_KEY'],
      message: 'required when AI_PROVIDER=openai',
    });
  }
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
