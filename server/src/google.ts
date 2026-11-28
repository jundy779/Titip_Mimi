import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity { sub: string; email: string; emailVerified: boolean; name: string }
export interface GoogleVerifier { verify(credential: string): Promise<GoogleIdentity> }
export const GOOGLE_VERIFIER = Symbol('GOOGLE_VERIFIER');

// Memverifikasi ID token dari Google Identity Services: tanda tangan, audience, issuer, kedaluwarsa.
export class OAuthGoogleVerifier implements GoogleVerifier {
  private client = new OAuth2Client();
  constructor(private audiences: string[]) {}
  async verify(credential: string): Promise<GoogleIdentity> {
    if (!this.audiences.length) throw new Error('GOOGLE_CLIENT_ID belum diatur');
    const ticket = await this.client.verifyIdToken({ idToken: credential, audience: this.audiences });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) throw new Error('payload tidak lengkap');
    return { sub: p.sub, email: p.email, emailVerified: Boolean(p.email_verified), name: p.given_name || p.name || '' };
  }
}
