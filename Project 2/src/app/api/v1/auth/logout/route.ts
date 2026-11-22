import { SESSION_COOKIE_NAME } from '@/lib/auth';
import { okResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = okResponse({ loggedOut: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
