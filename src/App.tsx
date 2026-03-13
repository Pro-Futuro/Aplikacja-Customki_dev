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
import type { AppState, DraftResult, GameRecord, TeamDraft } from "./types";

const defaultPlayers = Array.from({ length: 5 }, (_, index) => `Gracz${index + 1}`);
const emptyPoints = () => Array.from({ length: 5 }, () => "0");
const emptyChosen = () => Array.from({ length: 5 }, () => "");

type PairRow = {
  key: string;
  left: string;
  right: string;
  games: number;
  wins: number;
};

type PlayerSummary = {
  name: string;
  games: number;
  wins: number;
  losses: number;
  points: number;
  blueGames: number;
  redGames: number;
  championStats: Map<string, { games: number; wins: number }>;
};

type TeamStats = {
  bluePoints: number[];
  redPoints: number[];
  blueTotal: number;
  redTotal: number;
};

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

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTeamPoints(value: unknown) {
  if (!Array.isArray(value)) {
    return [0, 0, 0, 0, 0];
  }

  return Array.from({ length: 5 }, (_, index) => toNumber(value[index]));
}

function parsePoints(points: unknown): TeamStats {
  const record = typeof points === "object" && points !== null ? (points as Record<string, unknown>) : {};

  const bluePoints = normalizeTeamPoints(record.blue);
  const redPoints = normalizeTeamPoints(record.red);
  const blueTotal = bluePoints.reduce((sum, value) => sum + value, 0);
  const redTotal = redPoints.reduce((sum, value) => sum + value, 0);

  return { bluePoints, redPoints, blueTotal, redTotal };
}

function normalizePicks(value: unknown) {
  if (!Array.isArray(value)) {
    return ["", "", "", "", ""];
  }

  return Array.from({ length: 5 }, (_, index) =>
    typeof value[index] === "string" ? value[index] : "",
  );
}

function isBlueWinner(winner: string) {
  return winner.trim().toUpperCase() === "BLUE";
}

function formatRate(wins: number, games: number) {
  if (games === 0) {
    return "0.0%";
  }

  return `${((wins / games) * 100).toFixed(1)}%`;
}

function buildStats(games: GameRecord[]) {
  const playerMap = new Map<string, PlayerSummary>();
  const pairMap = new Map<string, PairRow>();

  function getPlayer(name: string) {
    if (!playerMap.has(name)) {
      playerMap.set(name, {
        name,
        games: 0,
        wins: 0,
        losses: 0,
        points: 0,
        blueGames: 0,
        redGames: 0,
        championStats: new Map(),
      });
    }

    return playerMap.get(name)!;
  }

  function recordTeam(names: string[], picks: string[], points: number[], won: boolean, side: "BLUE" | "RED") {
    const cleanNames = names.filter(Boolean);

    cleanNames.forEach((name, index) => {
      const player = getPlayer(name);
      player.games += 1;
      player.points += points[index] ?? 0;
      if (won) {
        player.wins += 1;
      } else {
        player.losses += 1;
      }

      if (side === "BLUE") {
        player.blueGames += 1;
      } else {
        player.redGames += 1;
      }

      const champion = picks[index] ?? "";
      if (champion) {
        const current = player.championStats.get(champion) ?? { games: 0, wins: 0 };
        current.games += 1;
        if (won) {
          current.wins += 1;
        }
        player.championStats.set(champion, current);
      }
    });

    for (let left = 0; left < cleanNames.length; left += 1) {
      for (let right = left + 1; right < cleanNames.length; right += 1) {
        const pair = [cleanNames[left], cleanNames[right]].sort((a, b) => a.localeCompare(b));
        const key = pair.join("::");
        const row = pairMap.get(key) ?? {
          key,
          left: pair[0],
          right: pair[1],
          games: 0,
          wins: 0,
        };

        row.games += 1;
        if (won) {
          row.wins += 1;
        }
        pairMap.set(key, row);
      }
    }
  }

  games.forEach((game) => {
    const blueWon = isBlueWinner(game.winner);
    const points = parsePoints(game.points);
    const bluePicks = normalizePicks(game.chosen_blue);
    const redPicks = normalizePicks(game.chosen_red);

    recordTeam(game.players_blue, bluePicks, points.bluePoints, blueWon, "BLUE");
    recordTeam(game.players_red, redPicks, points.redPoints, !blueWon, "RED");
  });

  const players = Array.from(playerMap.values()).sort((left, right) => {
    if (right.wins !== left.wins) {
      return right.wins - left.wins;
    }
    if (right.points !== left.points) {
      return right.points - left.points;
    }
    return left.name.localeCompare(right.name);
  });

  const pairs = Array.from(pairMap.values()).sort((left, right) => {
    if (right.wins !== left.wins) {
      return right.wins - left.wins;
    }
    if (right.games !== left.games) {
      return right.games - left.games;
    }
    return left.left.localeCompare(right.left) || left.right.localeCompare(right.right);
  });

  return { players, pairs };
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

function ResultEditor({
  draft,
  playersBlue,
  playersRed,
  winner,
  setWinner,
  pointsBlue,
  pointsRed,
  chosenBlue,
  chosenRed,
  setPointsBlue,
  setPointsRed,
  setChosenBlue,
  setChosenRed,
  onSave,
  busy,
}: {
  draft: DraftResult;
  playersBlue: string[];
  playersRed: string[];
  winner: string;
  setWinner: (winner: string) => void;
  pointsBlue: string[];
  pointsRed: string[];
  chosenBlue: string[];
  chosenRed: string[];
  setPointsBlue: (values: string[]) => void;
  setPointsRed: (values: string[]) => void;
  setChosenBlue: (values: string[]) => void;
  setChosenRed: (values: string[]) => void;
  onSave: () => Promise<void>;
  busy: boolean;
}) {
  function update(values: string[], setter: (next: string[]) => void, index: number, value: string) {
    const next = [...values];
    next[index] = value;
    setter(next);
  }

  function renderTeam(
    team: TeamDraft,
    names: string[],
    points: string[],
    chosen: string[],
    setPoints: (values: string[]) => void,
    setChosen: (values: string[]) => void,
  ) {
    return (
      <section className="result-team-card">
        <h3>
          {team.icon} {team.side} result entry
        </h3>
        <div className="result-player-list">
          {team.players.map((player) => {
            const index = player.player_index - 1;
            const name = names[index] || `Gracz${player.player_index}`;
            const championOptions = player.champs ?? null;

            return (
              <article className="result-player-row" key={`${team.side}-result-${player.player_index}`}>
                <div>
                  <strong>
                    {player.player_index}. {name}
                  </strong>
                  <span className="muted">
                    {championOptions
                      ? `Draft: ${championOptions[0]} / ${championOptions[1]}`
                      : "No champion pair assigned"}
                  </span>
                </div>
                <label>
                  Points
                  <input
                    type="number"
                    value={points[index]}
                    onChange={(event) => update(points, setPoints, index, event.target.value)}
                  />
                </label>
                <label>
                  Chosen champion
                  <select
                    value={chosen[index]}
                    onChange={(event) => update(chosen, setChosen, index, event.target.value)}
                  >
                    <option value="">Not selected</option>
                    {championOptions?.map((champion) => (
                      <option key={`${team.side}-${player.player_index}-${champion}`} value={champion}>
                        {champion}
                      </option>
                    ))}
                  </select>
                </label>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="history-panel">
      <div className="history-header">
        <h2>Save match result</h2>
        <div className="actions">
          <label className="inline-select">
            Winner
            <select value={winner} onChange={(event) => setWinner(event.target.value)}>
              <option value="BLUE">Blue</option>
              <option value="RED">Red</option>
            </select>
          </label>
          <button type="button" onClick={() => void onSave()} disabled={busy}>
            Save current result
          </button>
        </div>
      </div>

      <div className="result-layout">
        {renderTeam(draft.blue, playersBlue, pointsBlue, chosenBlue, setPointsBlue, setChosenBlue)}
        {renderTeam(draft.red, playersRed, pointsRed, chosenRed, setPointsRed, setChosenRed)}
      </div>
    </section>
  );
}

function StatsPanel({ history }: { history: AppState | null }) {
  const games = history?.games ?? [];
  const stats = buildStats(games);
  const totalBlueWins = games.filter((game) => isBlueWinner(game.winner)).length;
  const totalRedWins = games.length - totalBlueWins;

  return (
    <section className="history-panel">
      <div className="history-header">
        <h2>Stats and ranking</h2>
        <p className="muted">Derived from saved match history in your local app data.</p>
      </div>

      <div className="summary-grid">
        <article className="summary-card">
          <strong>Total games</strong>
          <span>{games.length}</span>
        </article>
        <article className="summary-card">
          <strong>Blue wins</strong>
          <span>{totalBlueWins}</span>
        </article>
        <article className="summary-card">
          <strong>Red wins</strong>
          <span>{totalRedWins}</span>
        </article>
        <article className="summary-card">
          <strong>Tracked players</strong>
          <span>{stats.players.length}</span>
        </article>
      </div>

      <div className="stats-grid">
        <section className="stats-card">
          <h3>Player ranking</h3>
          {stats.players.length === 0 ? (
            <p>No saved data yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Games</th>
                    <th>Wins</th>
                    <th>WR</th>
                    <th>Points</th>
                    <th>Blue</th>
                    <th>Red</th>
                    <th>Best champ</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.players.map((player) => {
                    const bestChampion = Array.from(player.championStats.entries()).sort((left, right) => {
                      if (right[1].wins !== left[1].wins) {
                        return right[1].wins - left[1].wins;
                      }
                      return right[1].games - left[1].games;
                    })[0];

                    return (
                      <tr key={player.name}>
                        <td>{player.name}</td>
                        <td>{player.games}</td>
                        <td>{player.wins}</td>
                        <td>{formatRate(player.wins, player.games)}</td>
                        <td>{player.points}</td>
                        <td>{player.blueGames}</td>
                        <td>{player.redGames}</td>
                        <td>
                          {bestChampion
                            ? `${bestChampion[0]} (${bestChampion[1].wins}/${bestChampion[1].games})`
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="stats-card">
          <h3>Duo win rate</h3>
          {stats.pairs.length === 0 ? (
            <p>No duo data yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th>Games</th>
                    <th>Wins</th>
                    <th>WR</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.pairs.map((pair) => (
                    <tr key={pair.key}>
                      <td>
                        {pair.left} + {pair.right}
                      </td>
                      <td>{pair.games}</td>
                      <td>{pair.wins}</td>
                      <td>{formatRate(pair.wins, pair.games)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
  const [pointsBlue, setPointsBlue] = useState<string[]>(emptyPoints);
  const [pointsRed, setPointsRed] = useState<string[]>(emptyPoints);
  const [chosenBlue, setChosenBlue] = useState<string[]>(emptyChosen);
  const [chosenRed, setChosenRed] = useState<string[]>(emptyChosen);

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

  function updateTeam(
    setter: (value: string[]) => void,
    source: string[],
    index: number,
    value: string,
  ) {
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
      setWinner("BLUE");
      setPointsBlue(emptyPoints());
      setPointsRed(emptyPoints());
      setChosenBlue(emptyChosen());
      setChosenRed(emptyChosen());
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
        chosenBlue,
        chosenRed,
        points: {
          blue: pointsBlue.map((value) => toNumber(value)),
          red: pointsRed.map((value) => toNumber(value)),
        },
      });
      setStatus("Match result, points, and selected champions saved.");
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
          <h1>Generate drafts, save full results, and inspect player or duo performance.</h1>
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
        <>
          <section className="draft-layout">
            <TeamPanel team={draft.blue} names={playersBlue} />
            <TeamPanel team={draft.red} names={playersRed} />
          </section>

          <ResultEditor
            draft={draft}
            playersBlue={playersBlue}
            playersRed={playersRed}
            winner={winner}
            setWinner={setWinner}
            pointsBlue={pointsBlue}
            pointsRed={pointsRed}
            chosenBlue={chosenBlue}
            chosenRed={chosenRed}
            setPointsBlue={setPointsBlue}
            setPointsRed={setPointsRed}
            setChosenBlue={setChosenBlue}
            setChosenRed={setChosenRed}
            onSave={handleSaveResult}
            busy={busy}
          />
        </>
      ) : (
        <section className="empty-state">
          <p>No draft generated yet. Save rosters and create one to see assignments here.</p>
        </section>
      )}

      <StatsPanel history={history} />

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

        <div className="history-list">
          {(history?.games ?? []).length === 0 ? (
            <p>No games saved yet.</p>
          ) : (
            history?.games
              .slice()
              .reverse()
              .map((game) => {
                const parsedPoints = parsePoints(game.points);
                const bluePicks = normalizePicks(game.chosen_blue).filter(Boolean);
                const redPicks = normalizePicks(game.chosen_red).filter(Boolean);

                return (
                  <article className="history-card" key={`${game.timestamp}-${game.winner}`}>
                    <strong>{game.timestamp}</strong>
                    <span>Winner: {game.winner}</span>
                    <span>Blue: {game.players_blue.join(", ")}</span>
                    <span>Red: {game.players_red.join(", ")}</span>
                    <span>
                      Points: {parsedPoints.blueTotal} blue / {parsedPoints.redTotal} red
                    </span>
                    <span>
                      Champions: {bluePicks.length > 0 ? bluePicks.join(", ") : "-"} |{" "}
                      {redPicks.length > 0 ? redPicks.join(", ") : "-"}
                    </span>
                  </article>
                );
              })
          )}
        </div>
      </section>
    </main>
  );
}
