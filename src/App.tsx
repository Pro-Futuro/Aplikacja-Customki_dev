import { FormEvent, useEffect, useState } from "react";
import {
  exportTeams,
  generateDraft,
  loadHistory,
  resetRanking,
  resetRotation,
  saveGameResult,
  setPlayers,
} from "./tauri";
import type { AppState, DraftResult, TeamDraft } from "./types";

const defaultPlayers = Array.from({ length: 5 }, (_, index) => `Gracz${index + 1}`);

function teamText(team: TeamDraft, names: string[]) {
  const lines = [
    `${team.icon} ${team.side}`,
    `Team challenge: ${team.team_challenge}`,
    `Solo challenge (${team.solo_player_index}): ${team.solo_challenge}`,
    "",
  ];

  for (const player of team.players) {
    const label = names[player.player_index - 1] || `Gracz${player.player_index}`;
    const champs = player.champs ? player.champs.join(" / ") : "-";
    lines.push(
      [
        `${player.player_index}. ${label}`,
        player.lane ? `Lane: ${player.lane}` : null,
        player.item ? `Item: ${player.item}` : null,
        player.summoner ? `Summoner: ${player.summoner}` : null,
        `Champions: ${champs}`,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }

  return lines.join("\n");
}

function TeamPanel({ team, names }: { team: TeamDraft; names: string[] }) {
  return (
    <section className="team-panel">
      <div className="team-header">
        <h2>
          {team.icon} {team.side}
        </h2>
        <p>{team.team_challenge}</p>
      </div>
      <div className="solo-card">
        <strong>Solo challenge</strong>
        <span>
          Player {team.solo_player_index}: {team.solo_challenge}
        </span>
      </div>
      <div className="player-grid">
        {team.players.map((player) => {
          const name = names[player.player_index - 1] || `Gracz${player.player_index}`;
          return (
            <article className="player-card" key={`${team.side}-${player.player_index}`}>
              <h3>
                {player.player_index}. {name}
              </h3>
              <p>{player.lane || "No forced lane"}</p>
              <p>{player.item ? `Item: ${player.item}` : "No forced item"}</p>
              <p>{player.summoner ? `Summoner: ${player.summoner}` : "No forced summoner"}</p>
              <p>
                {player.champs
                  ? `Champions: ${player.champs[0]} / ${player.champs[1]}`
                  : "No champion pair"}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function App() {
  const [playersBlue, setPlayersBlue] = useState<string[]>(defaultPlayers);
  const [playersRed, setPlayersRed] = useState<string[]>(defaultPlayers);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [history, setHistory] = useState<AppState | null>(null);
  const [winner, setWinner] = useState("BLUE");
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshHistory();
  }, []);

  async function refreshHistory() {
    try {
      const state = await loadHistory();
      setHistory(state);
      if (state.players_blue.length === 5) {
        setPlayersBlue(state.players_blue);
      }
      if (state.players_red.length === 5) {
        setPlayersRed(state.players_red);
      }
    } catch (error) {
      setStatus(`Could not load local history: ${String(error)}`);
    }
  }

  function updateTeam(setter: (value: string[]) => void, source: string[], index: number, value: string) {
    const next = [...source];
    next[index] = value;
    setter(next);
  }

  async function handleSavePlayers(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await setPlayers(playersBlue, playersRed);
      setStatus("Players saved locally.");
      await refreshHistory();
    } catch (error) {
      setStatus(`Saving players failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateDraft() {
    setBusy(true);
    try {
      const nextDraft = await generateDraft();
      setDraft(nextDraft);
      setStatus("Draft generated.");
    } catch (error) {
      setStatus(`Draft generation failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveResult() {
    if (!draft) {
      setStatus("Generate a draft before saving a result.");
      return;
    }

    setBusy(true);
    try {
      await saveGameResult({
        winner,
        draft,
        playersBlue,
        playersRed,
        chosenBlue: Array(5).fill(""),
        chosenRed: Array(5).fill(""),
      });
      setStatus("Match result saved.");
      await refreshHistory();
    } catch (error) {
      setStatus(`Saving result failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (!draft) {
      setStatus("Generate a draft before exporting.");
      return;
    }

    setBusy(true);
    try {
      const [bluePath, redPath] = await exportTeams(
        teamText(draft.blue, playersBlue),
        teamText(draft.red, playersRed),
      );
      setStatus(`Exported files to ${bluePath} and ${redPath}`);
    } catch (error) {
      setStatus(`Export failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleResetRanking() {
    setBusy(true);
    try {
      await resetRanking();
      setStatus("History cleared.");
      await refreshHistory();
    } catch (error) {
      setStatus(`Reset ranking failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleResetRotation() {
    setBusy(true);
    try {
      await resetRotation();
      setStatus("Rotation reset command sent.");
    } catch (error) {
      setStatus(`Reset rotation failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Customki desktop rebuild</p>
          <h1>Generate custom match drafts, track results, and export both teams.</h1>
        </div>
        <p className="status">{status}</p>
      </section>

      <section className="setup-panel">
        <form onSubmit={handleSavePlayers}>
          <div className="rosters">
            <div>
              <h2>Blue roster</h2>
              {playersBlue.map((player, index) => (
                <input
                  key={`blue-${index}`}
                  value={player}
                  onChange={(event) =>
                    updateTeam(setPlayersBlue, playersBlue, index, event.target.value)
                  }
                  placeholder={`Blue player ${index + 1}`}
                />
              ))}
            </div>
            <div>
              <h2>Red roster</h2>
              {playersRed.map((player, index) => (
                <input
                  key={`red-${index}`}
                  value={player}
                  onChange={(event) =>
                    updateTeam(setPlayersRed, playersRed, index, event.target.value)
                  }
                  placeholder={`Red player ${index + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="actions">
            <button type="submit" disabled={busy}>
              Save players
            </button>
            <button type="button" onClick={handleGenerateDraft} disabled={busy}>
              Generate draft
            </button>
            <button type="button" onClick={handleExport} disabled={busy || !draft}>
              Export teams
            </button>
          </div>
        </form>
      </section>

      {draft ? (
        <section className="draft-layout">
          <TeamPanel team={draft.blue} names={playersBlue} />
          <TeamPanel team={draft.red} names={playersRed} />
        </section>
      ) : (
        <section className="empty-state">
          <p>No draft generated yet. Save rosters and create one to see assignments here.</p>
        </section>
      )}

      <section className="history-panel">
        <div className="history-header">
          <h2>Match history</h2>
          <div className="actions">
            <button type="button" onClick={handleResetRanking} disabled={busy}>
              Clear history
            </button>
            <button type="button" onClick={handleResetRotation} disabled={busy}>
              Reset rotation
            </button>
          </div>
        </div>

        <div className="save-result">
          <label>
            Winner
            <select value={winner} onChange={(event) => setWinner(event.target.value)}>
              <option value="BLUE">Blue</option>
              <option value="RED">Red</option>
            </select>
          </label>
          <button type="button" onClick={handleSaveResult} disabled={busy || !draft}>
            Save current result
          </button>
        </div>

        <div className="history-list">
          {(history?.games ?? []).length === 0 ? (
            <p>No games saved yet.</p>
          ) : (
            history?.games
              .slice()
              .reverse()
              .map((game) => (
                <article className="history-card" key={`${game.timestamp}-${game.winner}`}>
                  <strong>{game.timestamp}</strong>
                  <span>Winner: {game.winner}</span>
                  <span>Blue: {game.players_blue.join(", ")}</span>
                  <span>Red: {game.players_red.join(", ")}</span>
                </article>
              ))
          )}
        </div>
      </section>
    </main>
  );
}
