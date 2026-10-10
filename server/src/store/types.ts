export type Persona = 'mentor' | 'drill' | 'hype';

/** none: never asked. pending: registered with Photon, waiting for their first text. active: texting allowed. stopped: they said STOP. */
export type OptIn = 'none' | 'pending' | 'active' | 'stopped';

export type Profile = {
  userId: string;
  name: string;
  phone: string | null;
  photonUserId: string | null;
  optIn: OptIn;
  persona: Persona;
  tz: string;
};

export type Prompt = { id: string; text: string };

export type Friend = { userId: string | null; name: string; phone: string | null };

export type Challenge = {
  id: string;
  fromUserId: string;
  toPhone: string;
  toName: string;
  promptId: string;
  /** challenger's score at the time, null if they had not taken today's prompt yet */
  score: number | null;
  sentAt: string | null;
};

export type CoachMessage = { role: 'user' | 'coach'; body: string; at: string };

/** One row of today's board: a user who has taken today's prompt. */
export type BoardEntry = { userId: string; name: string; score: number };

/** Rows are passed to the coach as-is, so whatever columns the scoring pipeline writes show up without changes here. */
export type Row = Record<string, unknown>;

export interface Store {
  createUser(name: string, tz: string): Promise<Profile>;
  getProfile(userId: string): Promise<Profile | null>;
  getProfileByPhone(phone: string): Promise<Profile | null>;
  updateProfile(userId: string, patch: Partial<Omit<Profile, 'userId'>>): Promise<Profile | null>;
  activeProfiles(): Promise<Profile[]>;

  todaysPrompt(): Promise<Prompt>;
  /** today's take for this user, or null if they have not done it yet */
  todaysAttempt(userId: string): Promise<{ score: number } | null>;
  /** Only the in-memory store writes here; with Tiger the scoring pipeline owns inserts. */
  recordAttempt(userId: string, score: number, detail: Row): Promise<void>;
  /** Consecutive days with a take, counted in the user's own time zone. */
  streak(userId: string, tz: string): Promise<number>;
  /** Everything stored about this user's takes, newest first. */
  history(userId: string, limit: number): Promise<Row[]>;
  /** Any other rows about the user the coach should see (account row, rating, league...). */
  extras(userId: string): Promise<Record<string, Row[]>>;
  /** Everyone who has taken today's prompt, best score first, each in their own calendar day. */
  todaysBoard(limit: number): Promise<BoardEntry[]>;

  addFriend(userId: string, phone: string, name: string): Promise<void>;
  linkFriend(userId: string, phone: string, friendUserId: string): Promise<void>;
  friendsOf(userId: string): Promise<Friend[]>;

  createChallenge(c: Omit<Challenge, 'id' | 'sentAt'>): Promise<Challenge>;
  getChallenge(id: string): Promise<Challenge | null>;
  markChallengeSent(id: string): Promise<void>;

  /** Returns false when this exact notification was already logged for that day. */
  logNotification(userId: string, kind: string, subject: string, day: string, body: string): Promise<boolean>;
  notificationCount(userId: string, day: string): Promise<number>;

  appendMessage(userId: string, role: CoachMessage['role'], body: string): Promise<void>;
  recentMessages(userId: string, limit: number): Promise<CoachMessage[]>;
}
