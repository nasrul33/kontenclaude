import { z } from 'zod';

export const CaptionSchema = z.object({
  body:     z.string().min(1).max(2200),
  hashtags: z.array(z.string().min(1)).min(1).max(30),
  title:    z.string().max(100).optional(),
  tags:     z.array(z.string()).max(500).optional(),
});

export type Caption = z.infer<typeof CaptionSchema>;
