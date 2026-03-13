import { invoke } from "@tauri-apps/api/core";
import type { AppState, DraftResult } from "./types";

export function generateDraft() {
  return invoke<DraftResult>("generate_draft");
}

export function loadHistory() {
  return invoke<AppState>("load_history");
}

export function setPlayers(playersBlue: string[], playersRed: string[]) {
  return invoke("set_players", { playersBlue, playersRed });
}

export function resetRanking() {
  return invoke("reset_ranking");
}

export function resetRotation() {
  return invoke("reset_rotation");
}

export function exportTeams(blueText: string, redText: string) {
  return invoke<[string, string]>("export_teams", { blueText, redText });
}

export function saveGameResult(params: {
  winner: string;
  draft: DraftResult;
  playersBlue: string[];
  playersRed: string[];
  chosenBlue: string[];
  chosenRed: string[];
}) {
  return invoke("save_game_result", {
    winner: params.winner,
    draft: params.draft,
    points: {},
    playersBlue: params.playersBlue,
    playersRed: params.playersRed,
    chosenBlue: params.chosenBlue,
    chosenRed: params.chosenRed,
  });
}
