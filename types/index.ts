export type UserProfile = {
  id: string;
  couple_id: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type CoupleData = {
  id: string;
  invite_code: string;
  relationship_start: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  couple_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
};

export type DailyNote = {
  id: string;
  couple_id: string;
  author_id: string;
  content: string;
  note_date: string;
  created_at: string;
};

export type LovePet = {
  id: string;
  couple_id: string;
  name: string;
  hunger: number;
  happiness: number;
  energy: number;
  updated_at: string;
};

export type Game = {
  id: string;
  couple_id: string;
  game_type: string;
  state: Record<string, unknown>;
  status: "waiting" | "active" | "finished";
  created_by: string;
  updated_at: string;
};

export type Memory = {
  id: string;
  couple_id: string;
  author_id: string;
  title: string;
  description: string | null;
  image_path: string;
  memory_date: string;
  created_at: string;
};

export type BucketItem = {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  completed: boolean;
  created_at: string;
};

export type LoveLetter = {
  id: string;
  couple_id: string;
  author_id: string;
  title: string;
  content: string;
  unlock_at: string;
  created_at: string;
};

export type MoodEntry = {
  id: string;
  couple_id: string;
  user_id: string;
  mood: string;
  note: string | null;
  created_at: string;
};