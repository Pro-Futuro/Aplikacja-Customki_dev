export type PlayerLine = {
  player_index: number;
  lane: string;
  item: string | null;
  summoner: string | null;
  champs: [string, string] | null;
};

export type TeamDraft = {
  side: string;
  icon: string;
  players: PlayerLine[];
  team_challenge: string;
  solo_challenge: string;
  solo_player_index: number;
};

export type DraftResult = {
  blue: TeamDraft;
  red: TeamDraft;
};

export type GameRecord = {
  timestamp: string;
  winner: string;
  draft: unknown;
  points: unknown;
  players_blue: string[];
  players_red: string[];
  chosen_blue: string[];
  chosen_red: string[];
};

export type AppState = {
  players_blue: string[];
  players_red: string[];
  games: GameRecord[];
};
