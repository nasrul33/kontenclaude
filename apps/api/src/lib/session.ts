import type { FastifyRequest, FastifyReply } from 'fastify';
import { getAuth } from '../plugins/auth.js';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

function toHeaders(raw: FastifyRequest['headers']): Headers {
  const headers = new Headers();
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(', '));
  }
  return headers;
}

export async function getSessionUser(req: FastifyRequest): Promise<SessionUser | null> {
  const auth = getAuth();
  const result = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!result?.user) return null;
  const { id, email, name } = result.user;
  return { id, email, name };
}

// Guard helper: returns the user or sends 401 and returns null.
export async function requireUser(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<SessionUser | null> {
  const user = await getSessionUser(req);
  if (!user) {
    await reply.code(401).send({ error: 'unauthorized' });
    return null;
  }
  return user;
}
