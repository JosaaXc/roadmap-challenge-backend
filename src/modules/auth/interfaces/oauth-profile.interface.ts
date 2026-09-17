/** Provider-agnostic shape a Passport OAuth strategy normalizes its raw profile into. */
export interface NormalizedOAuthProfile {
  providerAccountId: string;
  email: string;
  username: string;
  avatarUrl?: string;
  rawData: unknown;
}
