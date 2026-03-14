import { FormEvent, useEffect, useMemo, useState } from "react";
import { exportTeams, generateDraft, loadHistory, resetRanking, resetRotation, saveGameResult, setPlayers } from "./tauri";
import type { AppState, DraftResult, GameRecord, TeamDraft } from "./types";

type View = "draft" | "save" | "players" | "export" | "ranking" | "duos" | "chart" | "champions";
type Completion = { blueTeam: boolean; blueSolo: boolean; redTeam: boolean; redSolo: boolean };
type Eligibility = { blue: boolean[]; red: boolean[] };
type PlayerStats = { name: string; games: number; wins: number; points: number };
type PairStats = { key: string; left: string; right: string; games: number; wins: number };
type ChampionStats = { champion: string; games: number; wins: number };
type ChartSort = "winrate" | "wins" | "games" | "points" | "name";
type RankingSort = "wins" | "winrate" | "points" | "games" | "name";
type DuoSort = "winrate" | "wins" | "games" | "name";
type ChampionSort = "winrate" | "wins" | "games" | "name";

const names5 = Array.from({ length: 5 }, (_, i) => `Gracz${i + 1}`);
const emptyChosen = () => Array.from({ length: 5 }, () => "");
const emptyCompletion = (): Completion => ({ blueTeam: false, blueSolo: false, redTeam: false, redSolo: false });
const emptyEligibility = (): Eligibility => ({ blue: Array(5).fill(true), red: Array(5).fill(true) });

const nav = {
  actions: [
    ["draft", "Nowy draft"],
    ["save", "Zapisz wynik"],
    ["players", "Ustaw graczy"],
    ["export", "Eksportuj"],
  ],
  stats: [
    ["ranking", "Ranking"],
    ["duos", "Najlepsze duety"],
    ["chart", "Wykres winrate"],
    ["champions", "Statystyki championow"],
  ],
} as const;

const pointsFor = (label: string, solo: boolean) => {
  const n = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (n.includes("trudne")) return solo ? 3 : 7;
  if (n.includes("srednie") || label.includes("Ĺ›rednie") || label.includes("Ĺšrednie")) return solo ? 2 : 5;
  if (n.includes("latwe") || label.includes("Ĺ‚atwe") || label.includes("Ĺatwe")) return solo ? 1 : 4;
  return 0;
};

const challengePointsFor = (label: string, solo: boolean) => {
  const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const raw = label.toLowerCase();
  if (normalized.includes("trudne") || raw.includes("trudne")) return solo ? 3 : 7;
  if (normalized.includes("srednie") || raw.includes("rednie")) return solo ? 2 : 5;
  if (normalized.includes("latwe") || raw.includes("atwe")) return solo ? 1 : 4;
  return 0;
};

const rate = (wins: number, games: number) => (games ? `${((wins / games) * 100).toFixed(1)}%` : "0.0%");
const picks = (value: unknown) => (Array.isArray(value) ? Array.from({ length: 5 }, (_, i) => (typeof value[i] === "string" ? value[i] : "")) : ["", "", "", "", ""]);
const points = (value: unknown) => {
  const data = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const blueSource = Array.isArray(data.blue) ? data.blue : [];
  const redSource = Array.isArray(data.red) ? data.red : [];
  const blue = Array.from({ length: 5 }, (_, i) => Number(blueSource[i] ?? 0) || 0);
  const red = Array.from({ length: 5 }, (_, i) => Number(redSource[i] ?? 0) || 0);
  const breakdown = typeof data.breakdown === "object" && data.breakdown !== null ? data.breakdown as Record<string, any> : {};
  return { blue, red, breakdown, blueTotal: blue.reduce((a, b) => a + b, 0), redTotal: red.reduce((a, b) => a + b, 0) };
};

const buildPointsPayload = (draft: DraftResult, winner: string, completion: Completion) => {
  const blueWin = winner.trim().toUpperCase() === "BLUE" ? 5 : 0;
  const redWin = winner.trim().toUpperCase() === "BLUE" ? 0 : 5;
  const blueTeam = completion.blueTeam ? challengePointsFor(draft.blue.team_challenge, false) : 0;
  const redTeam = completion.redTeam ? challengePointsFor(draft.red.team_challenge, false) : 0;
  const blueSolo = completion.blueSolo ? challengePointsFor(draft.blue.solo_challenge, true) : 0;
  const redSolo = completion.redSolo ? challengePointsFor(draft.red.solo_challenge, true) : 0;
  return {
    blue: Array(5).fill(blueWin + blueTeam + blueSolo),
    red: Array(5).fill(redWin + redTeam + redSolo),
    breakdown: {
      blue: { win: blueWin, team: blueTeam, solo: blueSolo },
      red: { win: redWin, team: redTeam, solo: redSolo },
    },
  };
};

const applyEligibility = (base: { blue: number[]; red: number[] }, eligibility: Eligibility) => ({
  blue: base.blue.map((value, index) => (eligibility.blue[index] ? value : 0)),
  red: base.red.map((value, index) => (eligibility.red[index] ? value : 0)),
});

const teamText = (team: TeamDraft, names: string[], includeChallenges: boolean) => {
  const lines = [`${team.icon} ${team.side}`, ""];
  for (const player of team.players) {
    const label = names[player.player_index - 1] || `Gracz${player.player_index}`;
    lines.push(
      player.champs
        ? `${label}: Propozycje championow: ${player.champs[0]} / ${player.champs[1]}`
        : `${label}: LINIA ${player.lane} | Item: ${player.item ?? "-"} | Spell: ${player.summoner ?? "-"}`,
    );
  }
  if (includeChallenges) {
    lines.push("");
    lines.push(`Team challenge: ${team.team_challenge}`);
    lines.push(`Solo challenge (${names[team.solo_player_index - 1] || `Gracz${team.solo_player_index}`}): ${team.solo_challenge}`);
  }
  return lines.join("\n");
};

function buildStats(games: GameRecord[]) {
  const players = new Map<string, PlayerStats>();
  const duos = new Map<string, PairStats>();
  const champs = new Map<string, ChampionStats>();
  const ensure = (name: string) => {
    if (!players.has(name)) players.set(name, { name, games: 0, wins: 0, points: 0 });
    return players.get(name)!;
  };
  for (const game of games) {
    const blueWon = game.winner.toUpperCase() === "BLUE";
    const pts = points(game.points);
    const bluePicks = picks(game.chosen_blue);
    const redPicks = picks(game.chosen_red);
    const handleTeam = (team: string[], won: boolean, teamPoints: number[], teamPicks: string[]) => {
      const clean = team.filter(Boolean);
      clean.forEach((name, i) => {
        const row = ensure(name);
        row.games += 1;
        row.points += teamPoints[i] ?? 0;
        if (won) row.wins += 1;
        const c = teamPicks[i];
        if (c) {
          const champ = champs.get(c) ?? { champion: c, games: 0, wins: 0 };
          champ.games += 1;
          if (won) champ.wins += 1;
          champs.set(c, champ);
        }
      });
      for (let i = 0; i < clean.length; i += 1) {
        for (let j = i + 1; j < clean.length; j += 1) {
          const pair = [clean[i], clean[j]].sort((a, b) => a.localeCompare(b));
          const key = pair.join("::");
          const row = duos.get(key) ?? { key, left: pair[0], right: pair[1], games: 0, wins: 0 };
          row.games += 1;
          if (won) row.wins += 1;
          duos.set(key, row);
        }
      }
    };
    handleTeam(game.players_blue, blueWon, pts.blue, bluePicks);
    handleTeam(game.players_red, !blueWon, pts.red, redPicks);
  }
  return {
    players: Array.from(players.values()).sort((a, b) => b.wins - a.wins || b.points - a.points || a.name.localeCompare(b.name)),
    duos: Array.from(duos.values()).sort((a, b) => b.wins - a.wins || b.games - a.games),
    champions: Array.from(champs.values()).sort((a, b) => b.wins - a.wins || b.games - a.games),
  };
}

function renderDraftTeam(team: TeamDraft, names: string[]) {
  return (
    <section className="draft-team-panel">
      <h2 className={`side-title ${team.side === "BLUE" ? "blue" : "red"}`}>{team.side} SIDE</h2>
      <div className="draft-rows">
        {team.players.map((player) => {
          const name = names[player.player_index - 1] || `Gracz${player.player_index}`;
          const text = player.champs
            ? `Propozycje championow: ${player.champs[0]} / ${player.champs[1]}`
            : `LINIA ${player.lane} | Item: ${player.item ?? "-"} | Spell: ${player.summoner ?? "-"}`;
          return (
            <article className="draft-row" key={`${team.side}-${player.player_index}`}>
              <strong>{name}</strong>
              <span>{text}</span>
            </article>
          );
        })}
        <article className="draft-row quest-row">
          <strong>Wyzwania</strong>
          <span>[ukryte - uzyj "Pokaz zadania"]</span>
        </article>
      </div>
    </section>
  );
}

export default function App() {
  const [view, setView] = useState<View>("draft");
  const [playersBlue, setPlayersBlue] = useState<string[]>(names5);
  const [playersRed, setPlayersRed] = useState<string[]>(names5);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [history, setHistory] = useState<AppState | null>(null);
  const [winner, setWinner] = useState("BLUE");
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [chosenBlue, setChosenBlue] = useState<string[]>(emptyChosen);
  const [chosenRed, setChosenRed] = useState<string[]>(emptyChosen);
  const [completion, setCompletion] = useState<Completion>(emptyCompletion);
  const [eligibility, setEligibility] = useState<Eligibility>(emptyEligibility);
  const [chartSort, setChartSort] = useState<ChartSort>("winrate");
  const [rankingSort, setRankingSort] = useState<RankingSort>("wins");
  const [duoSort, setDuoSort] = useState<DuoSort>("winrate");
  const [championSort, setChampionSort] = useState<ChampionSort>("winrate");
  const [confirmClear, setConfirmClear] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const state = await loadHistory();
        setHistory(state);
        if (state.players_blue.length === 5) setPlayersBlue(state.players_blue);
        if (state.players_red.length === 5) setPlayersRed(state.players_red);
      } catch (error) {
        setStatus(`Could not load local history: ${String(error)}`);
      }
    })();
  }, []);

  const stats = useMemo(() => buildStats(history?.games ?? []), [history]);

  const savePlayersForm = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await setPlayers(playersBlue, playersRed);
      const state = await loadHistory();
      setHistory(state);
      setStatus("Players saved locally.");
    } catch (error) {
      setStatus(`Saving players failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const newDraft = async () => {
    setBusy(true);
    try {
      setDraft(await generateDraft());
      setWinner("BLUE");
      setChosenBlue(emptyChosen());
      setChosenRed(emptyChosen());
      setCompletion(emptyCompletion());
      setEligibility(emptyEligibility());
      setView("draft");
      setStatus("Draft generated.");
    } catch (error) {
      setStatus(`Draft generation failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const saveResult = async () => {
    if (!draft) return setStatus("Generate a draft before saving a result.");
    setBusy(true);
    try {
      const base = buildPointsPayload(draft, winner, completion);
      await saveGameResult({
        winner,
        draft,
        playersBlue,
        playersRed,
        chosenBlue,
        chosenRed,
        points: { ...base, ...applyEligibility(base, eligibility) },
      });
      setHistory(await loadHistory());
      setStatus("Result saved.");
    } catch (error) {
      setStatus(`Saving result failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const doExport = async (withChallenges: boolean) => {
    if (!draft) return setStatus("Generate a draft before exporting.");
    setBusy(true);
    try {
      const [bluePath, redPath] = await exportTeams(
        teamText(draft.blue, playersBlue, withChallenges),
        teamText(draft.red, playersRed, withChallenges),
      );
      setStatus(`Exported files to ${bluePath} and ${redPath}`);
    } catch (error) {
      setStatus(`Export failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const clearHistory = async () => {
    if (confirmClear.trim().toUpperCase() !== "USUN HISTORIE") {
      setStatus('Aby wyczyscic historie, wpisz dokladnie "USUN HISTORIE".');
      return;
    }
    setBusy(true);
    try {
      await resetRanking();
      setHistory(await loadHistory());
      setConfirmClear("");
      setStatus("History cleared.");
    } catch (error) {
      setStatus(`Reset ranking failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const doResetRotation = async () => {
    setBusy(true);
    try {
      await resetRotation();
      setStatus("Rotation reset command sent.");
    } catch (error) {
      setStatus(`Reset rotation failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const projected = draft ? buildPointsPayload(draft, winner, completion) : null;
  const sortedChartPlayers = useMemo(() => {
    const winrate = (player: PlayerStats) => (player.games ? player.wins / player.games : 0);
    return [...stats.players].sort((a, b) => {
      if (chartSort === "name") return a.name.localeCompare(b.name);
      if (chartSort === "games") return b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name);
      if (chartSort === "wins") return b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name);
      if (chartSort === "points") return b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name);
      return winrate(b) - winrate(a) || b.games - a.games || b.points - a.points || a.name.localeCompare(b.name);
    });
  }, [chartSort, stats.players]);
  const sortedRankingPlayers = useMemo(() => {
    const winrate = (player: PlayerStats) => (player.games ? player.wins / player.games : 0);
    return [...stats.players].sort((a, b) => {
      if (rankingSort === "name") return a.name.localeCompare(b.name);
      if (rankingSort === "games") return b.games - a.games || b.wins - a.wins || b.points - a.points || a.name.localeCompare(b.name);
      if (rankingSort === "points") return b.points - a.points || b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name);
      if (rankingSort === "winrate") return winrate(b) - winrate(a) || b.games - a.games || b.points - a.points || a.name.localeCompare(b.name);
      return b.wins - a.wins || b.points - a.points || b.games - a.games || a.name.localeCompare(b.name);
    });
  }, [rankingSort, stats.players]);
  const sortedDuos = useMemo(() => {
    const winrate = (pair: PairStats) => (pair.games ? pair.wins / pair.games : 0);
    return [...stats.duos].sort((a, b) => {
      if (duoSort === "name") return `${a.left}${a.right}`.localeCompare(`${b.left}${b.right}`);
      if (duoSort === "games") return b.games - a.games || b.wins - a.wins || a.left.localeCompare(b.left);
      if (duoSort === "wins") return b.wins - a.wins || b.games - a.games || a.left.localeCompare(b.left);
      return winrate(b) - winrate(a) || b.games - a.games || b.wins - a.wins || a.left.localeCompare(b.left);
    });
  }, [duoSort, stats.duos]);
  const sortedChampions = useMemo(() => {
    const winrate = (champion: ChampionStats) => (champion.games ? champion.wins / champion.games : 0);
    return [...stats.champions].sort((a, b) => {
      if (championSort === "name") return a.champion.localeCompare(b.champion);
      if (championSort === "games") return b.games - a.games || b.wins - a.wins || a.champion.localeCompare(b.champion);
      if (championSort === "wins") return b.wins - a.wins || b.games - a.games || a.champion.localeCompare(b.champion);
      return winrate(b) - winrate(a) || b.games - a.games || b.wins - a.wins || a.champion.localeCompare(b.champion);
    });
  }, [championSort, stats.champions]);

  const screen = (() => {
    if (view === "draft") {
      return draft ? <section className="draft-board-layout">{renderDraftTeam(draft.blue, playersBlue)}{renderDraftTeam(draft.red, playersRed)}</section> : <section className="empty-view"><h2>Nowy draft</h2><p>Wygeneruj draft, aby zobaczyc plansze BLUE SIDE i RED SIDE.</p></section>;
    }
    if (view === "players") {
      return <section className="content-card"><h2>Ustaw graczy</h2><form onSubmit={(event) => void savePlayersForm(event)}><div className="rosters"><div><h3>Blue roster</h3>{playersBlue.map((player, i) => <input key={`b-${i}`} value={player} onChange={(e) => { const next = [...playersBlue]; next[i] = e.target.value; setPlayersBlue(next); }} />)}</div><div><h3>Red roster</h3>{playersRed.map((player, i) => <input key={`r-${i}`} value={player} onChange={(e) => { const next = [...playersRed]; next[i] = e.target.value; setPlayersRed(next); }} />)}</div></div><div className="toolbar"><button type="submit" disabled={busy}>Zapisz graczy</button></div></form></section>;
    }
    if (view === "export") {
      return draft ? <section className="content-card"><h2>Eksport dla kapitanow</h2><p className="muted">Zadania pozostaja ukryte w aplikacji i sa przekazywane tylko w plikach eksportu.</p><div className="export-preview-grid"><pre className="export-preview">{teamText(draft.blue, playersBlue, false)}</pre><pre className="export-preview">{teamText(draft.red, playersRed, false)}</pre></div><div className="toolbar"><button type="button" onClick={() => void doExport(true)} disabled={busy}>Eksportuj pliki kapitanow</button></div></section> : <section className="empty-view"><h2>Eksportuj</h2><p>Brak draftu do eksportu.</p></section>;
    }
    if (view === "save") {
      return draft && projected ? <section className="content-card"><div className="save-header"><h2>Zapisz wynik</h2><div className="toolbar"><label className="inline-select">Winner<select value={winner} onChange={(e) => setWinner(e.target.value)}><option value="BLUE">Blue</option><option value="RED">Red</option></select></label><button type="button" onClick={() => void saveResult()} disabled={busy}>Zapisz wynik</button></div></div><div className="result-layout">{(["blue", "red"] as const).map((side) => { const team = side === "blue" ? draft.blue : draft.red; const names = side === "blue" ? playersBlue : playersRed; const chosen = side === "blue" ? chosenBlue : chosenRed; const setChosen = side === "blue" ? setChosenBlue : setChosenRed; const teamDone = side === "blue" ? completion.blueTeam : completion.redTeam; const soloDone = side === "blue" ? completion.blueSolo : completion.redSolo; const projectedPoints = projected[side]; return <section className="result-team-card" key={side}><h3 className={side === "blue" ? "blue-text" : "red-text"}>{team.side} SIDE</h3><div className="challenge-flags"><label className="checkbox-row"><input type="checkbox" checked={teamDone} onChange={(e) => setCompletion({ ...completion, [side === "blue" ? "blueTeam" : "redTeam"]: e.target.checked })} />Team challenge completed</label><label className="checkbox-row"><input type="checkbox" checked={soloDone} onChange={(e) => setCompletion({ ...completion, [side === "blue" ? "blueSolo" : "redSolo"]: e.target.checked })} />Solo challenge completed</label><span className="muted">Breakdown: win {projected.breakdown[side].win ?? 0} + team {projected.breakdown[side].team ?? 0} + solo {projected.breakdown[side].solo ?? 0}</span></div><div className="result-player-list">{team.players.map((player) => { const index = player.player_index - 1; return <article className="result-player-row" key={`${side}-${index}`}><div><strong>{names[index]}</strong><span className="muted">{player.champs ? `Propozycja: ${player.champs[0]} / ${player.champs[1]}` : `Linia ${player.lane}, Item ${player.item}, Spell ${player.summoner}`}</span></div><label>Wybrany champion<select value={chosen[index]} onChange={(e) => { const next = [...chosen]; next[index] = e.target.value; setChosen(next); }}><option value="">Nie wybrano</option>{player.champs?.map((champ) => <option key={`${side}-${champ}`} value={champ}>{champ}</option>)}</select></label><label className="checkbox-row eligibility-box"><input type="checkbox" checked={eligibility[side][index]} onChange={(e) => { const next = { ...eligibility, [side]: [...eligibility[side]] }; next[side][index] = e.target.checked; setEligibility(next); }} />Spelnil wymagania</label><span className="result-points-chip">{eligibility[side][index] ? `${projectedPoints[index]} pts` : "0 pts"}</span></article>; })}</div></section>; })}</div></section> : <section className="empty-view"><h2>Zapisz wynik</h2><p>Najpierw wygeneruj draft.</p></section>;
    }
    if (view === "ranking") return <section className="content-card"><div className="stats-header"><h2>Ranking</h2><label className="inline-select">Sortuj<select value={rankingSort} onChange={(e) => setRankingSort(e.target.value as RankingSort)}><option value="wins">Wygrane</option><option value="winrate">Winrate</option><option value="points">Punkty</option><option value="games">Liczba gier</option><option value="name">Nazwa</option></select></label></div><div className="table-wrap"><table className="stats-table"><thead><tr><th>Player</th><th>Games</th><th>Wins</th><th>WR</th><th>Points</th></tr></thead><tbody>{sortedRankingPlayers.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.games}</td><td>{p.wins}</td><td>{rate(p.wins, p.games)}</td><td>{p.points}</td></tr>)}</tbody></table></div></section>;
    if (view === "duos") return <section className="content-card"><div className="stats-header"><h2>Najlepsze duety</h2><label className="inline-select">Sortuj<select value={duoSort} onChange={(e) => setDuoSort(e.target.value as DuoSort)}><option value="winrate">Winrate</option><option value="wins">Wygrane</option><option value="games">Liczba gier</option><option value="name">Nazwa</option></select></label></div><div className="table-wrap"><table className="stats-table"><thead><tr><th>Duet</th><th>Games</th><th>Wins</th><th>WR</th></tr></thead><tbody>{sortedDuos.map((p) => <tr key={p.key}><td>{p.left} + {p.right}</td><td>{p.games}</td><td>{p.wins}</td><td>{rate(p.wins, p.games)}</td></tr>)}</tbody></table></div></section>;
    if (view === "chart") return <section className="content-card"><div className="chart-header"><div><h2>Wykres winrate</h2><p className="muted">Slupek pokazuje realny winrate, a obok widac pelny bilans gracza.</p></div><label className="inline-select">Sortuj<select value={chartSort} onChange={(e) => setChartSort(e.target.value as ChartSort)}><option value="winrate">Winrate</option><option value="wins">Wygrane</option><option value="games">Liczba gier</option><option value="points">Punkty</option><option value="name">Nazwa</option></select></label></div><div className="chart-list">{sortedChartPlayers.map((p) => { const wr = p.games ? (p.wins / p.games) * 100 : 0; return <article className="chart-row card-like" key={p.name}><div className="chart-labels"><strong>{p.name}</strong><span>{rate(p.wins, p.games)} ({p.wins}/{p.games}) • {p.points} pkt</span></div><div className="chart-track"><div className="chart-fill" style={{ width: `${wr}%` }} /></div></article>; })}</div></section>;
    return <section className="content-card"><div className="stats-header"><div><h2>Statystyki championow</h2><p className="muted">Statystyki dotycza samych championow, niezaleznie od tego kto nimi gral.</p></div><label className="inline-select">Sortuj<select value={championSort} onChange={(e) => setChampionSort(e.target.value as ChampionSort)}><option value="winrate">Winrate</option><option value="wins">Wygrane</option><option value="games">Liczba gier</option><option value="name">Nazwa</option></select></label></div><div className="table-wrap"><table className="stats-table"><thead><tr><th>Champion</th><th>Games</th><th>Wins</th><th>WR</th></tr></thead><tbody>{sortedChampions.map((c) => <tr key={c.champion}><td>{c.champion}</td><td>{c.games}</td><td>{c.wins}</td><td>{rate(c.wins, c.games)}</td></tr>)}</tbody></table></div></section>;
  })();

  return (
    <main className="desktop-shell">
      <aside className="sidebar">
        <div className="brand"><h1>Customki</h1></div>
        <div className="nav-section"><span className="nav-section-title">Glowne akcje</span>{nav.actions.map(([id, label]) => <button key={id} type="button" className={`nav-button${view === id ? " active" : ""}`} onClick={() => setView(id as View)}>{label}</button>)}</div>
        <div className="nav-section"><span className="nav-section-title">Statystyki</span>{nav.stats.map(([id, label]) => <button key={id} type="button" className={`nav-button${view === id ? " active" : ""}`} onClick={() => setView(id as View)}>{label}</button>)}</div>
      </aside>
      <section className="workspace">
        <header className="topbar"><div><p className="eyebrow">Customki desktop rebuild</p><h2>{[...nav.actions, ...nav.stats].find(([id]) => id === view)?.[1] ?? "Customki"}</h2></div><div className="topbar-actions"><button type="button" onClick={() => void newDraft()} disabled={busy}>New draft</button><button type="button" onClick={() => void doResetRotation()} disabled={busy}>Reset rotation</button></div></header>
        <section className="danger-zone">
          <div>
            <strong>Wyczysc historie</strong>
            <p className="muted">Ta akcja usuwa wszystkie zapisane wyniki. Aby ja odblokowac, wpisz: <code>USUN HISTORIE</code></p>
          </div>
          <div className="danger-actions">
            <input value={confirmClear} onChange={(e) => setConfirmClear(e.target.value)} placeholder="Wpisz: USUN HISTORIE" />
            <button type="button" className="danger-button" onClick={() => void clearHistory()} disabled={busy || confirmClear.trim().toUpperCase() !== "USUN HISTORIE"}>Clear history</button>
          </div>
        </section>
        <p className="status-banner">{status}</p>
        {screen}
      </section>
    </main>
  );
}
