use rand::seq::SliceRandom;
use rand::Rng;
use std::collections::HashSet;

use tauri::Manager;
use std::fs;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};

const VIRTUAL_ROLES: [&str; 5] = ["Top", "Jungle", "Mid", "ADC", "Support"];

const SUMMONER_SPELLS: [&str; 7] = [
    "Ignite","Teleport","Heal","Barrier",
    "Exhaust","Ghost","Cleanse"
];

// PEŁNA LISTA ZADAŃ SOLO Z CUSTOMKI 2.2
const SOLO_CHALLENGES: [&str; 33] = [
    "Zadaj 30 000 obrażeń w grze. (Średnie)",
    "Zdobądź 3 kille przed 10. minutą. (Średnie)",
    "Nie zgiń przez pierwsze 13 minut gry. (Średnie)",
    "Zdobądź pierwszą krew (First Blood). (Łatwe)",
    "Zrób co najmniej 15 asyst. (Łatwe)",
    "Zrób quadra kill lub pentakill. (Trudne)",
    "Miej więcej farmy niż przeciwnik na swojej linii do 15. minuty. (Łatwe)",
    "Nie oddaj żadnej wieży na swojej linii do 15. minuty. (Średnie)",
    "Zdobądź vision score mniejszy niż 10. (Łatwe)",
    "Nie wracaj do bazy przed 12 minutą - śmierć się nie liczy. (Średnie)",
    "Nie używaj ultimate przez całą grę. (Trudne)",
    "Kup tylko przedmioty z maną. (Średnie)",
    "Nie kupuj żadnych przedmiotów defensywnych - bez jakiegokolwiek hp/armor/MR. (Średnie)",
    "Zagraj całą grę bez butów. (Średnie)",
    "Kupuj tylko przedmioty z aktywem oprócz butów. (Trudne)",
    "Zdobądź ostatni kill w grze. (Średnie)",
    "Postaw control warda na fontannie przeciwnika. (Średnie)",
    "Wygraj grę bez killa. (Trudne)",
    "Zrób perfect KDA, minimum 6 KP. (Trudne)",
    "Zdobądź 1 kill pod wieżą przeciwnika. (Średnie)",
    "Zadaj 550 obrażeń jednym critical strike. (Średnie)",
    "Zdobądź kill na każdym z pięciu przeciwników. (Trudne)",
    "Wygraj grę mając więcej CS/min niż asyst. (Średnie)",
    "Zdobądź 300 stacków na Heartsteel. (Średnie)",
    "Każdy item w twoim ekwipunku musi dawać AD, oprócz butów. (Łatwe)",
    "Łakomczuch. Zjedz 3 ciastka, wypij 5 czerwonych potek, wypij 4 zielone potki, zjedź 8 żelków z rzeki, wypij potke statystyk. (Łatwe)",
    "Wbij szybciej 6 poziom od przeciwnika z linii. (Łatwe)",
    "Wbij 25 stacków na Mejai's Soulstealer. (Trudne)",
    "Zabij wszystkie buffy(Red&Blue) w obu junglach. (Łatwe)",
    "Zabij solo smoka. (Trudne)",
    "Zadaj ostatni cios 5 turretom. (Trudne)",
    "Czerwony build. (Łatwe)",
    "Zdobądź pod koniec gry minimum 10k golda. (Łatwe)"    
];

// PEŁNA LISTA ZADAŃ DRUŻYNOWYCH Z CUSTOMKI 2.2
const TEAM_CHALLENGES: [&str; 20] = [
    "Wszyscy mają mieć te same buty. (Łatwe)",
    "Każdy musi mieć ten sam trinket. (Łatwe)",
    "Wygraj grę bez oddania smoka. (Trudne)",
    "Zniszcz wieżę przed 12 minutą. (Średnie)",
    "Wszyscy grają bez ultimate. (Trudne)",
    "Cała drużyna bez przedmiotów defensywnych - bez jakiegokolwiek hp/armor/MR. (Trudne)",
    "Cała gra bez recall. (Trudne)",
    "Zniszcz inhiba przed 19 minutą. (Średnie)",
    "Cała drużyna musi użyć Teleportacji (Summoner Spell) przynajmniej raz, by pojawić się w tym samym miejscu w tym samym czasie. Jungler co by nie bylo bierze TP (Trudne)",
    "Twoja drużyna musi zabić oba kraby na rzece przy każdym ich odrodzeniu do minuty 12:00. (Średnie)",
    "Każdy z graczy pod koniec gierki musi mieć minimum 100 armoror i resist. (Średnie)",
    "Zrób ACE bez straty żadnego zawodnika. (Średnie)",
    "Wygrajcie gre pozostawiając przeciwnika bez inhibów. (Trudne)",
    "Żaden item nie może się powtarzać w teamie. (Łatwe)",
    "Każdy z drużyny musi zabić 2 campy w jungli przeciwnika. (Średnie)",
    "Postaw 30 Control Ward do 10 minuty minimum za swoją wieżą T3. (Średnie) ",
    "Drużynowo zdobądź 100 stacków Dark Harvest do końca gry. (Trudne)",
    "W teamie musi być Lorowe rodzeństwo. (Łatwe)",
    "Wszyscy w teamie muszą miec te samą runę główną. (Średnie)",
    "Cała drużyna bez Dasha. (Średnie)"

];

// PEŁNA LISTA ITEMÓW Z CUSTOMKI 2.2
const ITEMS: [&str; 113] = [
    "Abyssal Mask","Actualizer","Archangel's Staff","Ardent Censer","Axiom Arc","Bandlepipes",
    "Banshee's Veil","Bastionbreaker","Black Cleaver","Blackfire Torch",
    "Blade of the Ruined King","Bloodletter's Curse","Bloodthirster","Celestial Opposition",
    "Chempunk Chainsword","Cosmic Drive","Cryptbloom","Dawncore","Dead Man's Plate",
    "Death's Dance","Diadem of Songs","Dream Maker","Dusk and Dawn","Echoes of Helia",
    "Eclipse","Edge of Night","Endless Hunger","Essence Reaver","Experimental Hexplate",
    "Fiendhunter Bolts","Fimbulwinter","Force of Nature","Frozen Heart","Guardian Angel",
    "Guinsoo's Rageblade","Heartsteel","Hexoptics C44","Hextech Rocketbelt","Hollow Radiance",
    "Horizon Focus","Hubris","Hullbreaker","Iceborn Gauntlet","Immortal Shieldbow",
    "Infinity Edge","Jak'Sho, The Protean","Kaenic Rookern","Kraken Slayer","Liandry's Torment",
    "Lich Bane","Lord Dominik's Regards","Luden's Echo","Malignance","Manamune",
    "Maw of Malmortius","Mejai's Soulstealer","Mercurial Scimitar","Morellonomicon",
    "Mortal Reminder","Muramana","Nashor's Tooth","Navori Flickerblade","Opportunity",
    "Overlord's Bloodmail","Phantom Dancer","Profane Hydra","Protoplasm Harness",
    "Rabadon's Deathcap","Randuin's Omen","Rapid Firecannon","Ravenous Hydra","Riftmaker",
    "Rod of Ages","Runaan's Hurricane","Rylai's Crystal Scepter","Seraph's Embrace",
    "Serpent's Fang","Serylda's Grudge","Shadowflame","Spear of Shojin","Spirit Visage",
    "Staff of Flowing Water","Statikk Shiv","Sterak's Gage","Stormsurge","Stridebreaker",
    "Sundered Sky","Sunfire Aegis","Terminus","The Collector","Thornmail","Titanic Hydra",
    "Trailblazer","Trinity Force","Umbral Glaive","Unending Despair","Void Staff",
    "Voltaic Cyclosword","Warmog's Armor","Whispering Circlet","Winter's Approach",
    "Wit's End","Youmuu's Ghostblade","Yun Tal Wildarrows",
    "Zhonya's Hourglass","Imperial Mandate","Locket of the Iron Solari",
    "Moonstone Renewer","Shurelya's Battlesong","Redemption","Knight's Vow",
    "Mikael's Blessing","Zeke's Convergence"
];

// PEŁNA LISTA CHAMPIONÓW
const CHAMPIONS: [&str; 172] = [
    "Aatrox","Ahri","Akali","Akshan","Alistar","Ambessa","Amumu","Anivia","Annie","Aphelios","Ashe","Aurelion Sol","Aurora","Azir",
    "Bard","Bel'Veth","Blitzcrank","Brand","Braum","Briar","Caitlyn","Camille","Cassiopeia","Cho'Gath","Corki","Darius","Diana","Dr. Mundo",
    "Draven","Ekko","Elise","Evelynn","Ezreal","Fiddlesticks","Fiora","Fizz","Galio","Gangplank","Garen","Gnar","Gragas","Graves","Gwen","Hecarim",
    "Heimerdinger","Hwei","Illaoi","Irelia","Ivern","Janna","Jarvan IV","Jax","Jayce","Jhin","Jinx","K'Sante","Kai'Sa","Kalista","Karma","Karthus",
    "Kassadin","Katarina","Kayle","Kayn","Kennen","Kha'Zix","Kindred","Kled","Kog'Maw","LeBlanc","Lee Sin","Leona","Lillia","Lissandra","Lucian","Lulu",
    "Lux","Malphite","Malzahar","Maokai","Master Yi","Mel","Milio","Miss Fortune","Mordekaiser","Morgana","Naafiri","Nami","Nasus","Nautilus","Neeko","Nidalee",
    "Nilah","Nocturne","Nunu & Willump","Olaf","Orianna","Ornn","Pantheon","Poppy","Pyke","Qiyana","Quinn","Rakan","Rammus","Rek'Sai","Rell","Renata Glasc",
    "Renekton","Rengar","Riven","Rumble","Ryze","Samira","Sejuani","Senna","Seraphine","Sett","Shaco","Shen","Shyvana","Singed","Sion","Sivir","Skarner","Smolder",
    "Sona","Soraka","Swain","Sylas","Syndra","Tahm Kench","Taliyah","Talon","Taric","Teemo","Thresh","Tristana","Trundle","Tryndamere","Twisted Fate","Twitch",
    "Udyr","Urgot","Varus","Vayne","Veigar","Vel'Koz","Vex","Vi","Viego","Viktor","Vladimir","Volibear","Warwick","Wukong","Xayah","Xerath","Xin Zhao","Yasuo",
    "Yone","Yorick","Yunara","Yuumi","Zaahen","Zac","Zed","Zeri","Ziggs","Zilean","Zoe","Zyra"

];

fn get_virtual_role(champion: &str) -> &'static str {
    let idx = (seahash::hash(champion.as_bytes()) as usize) % VIRTUAL_ROLES.len();
    VIRTUAL_ROLES[idx]
}

fn get_difficulty(challenge: &str) -> &'static str {
    let t = challenge.to_lowercase();
    if t.contains("trudne") {
        "Trudne"
    } else if t.contains("średnie") {
        "Średnie"
    } else if t.contains("łatwe") {
        "Łatwe"
    } else {
        "Inne"
    }
}

// DLA OBU DRUŻYN: ta sama trudność, dwa różne zadania
fn pick_challenge_for_both(all: &[&str]) -> (String, String) {
    let mut rng = rand::thread_rng();
    let diff_options = ["Łatwe", "Średnie", "Trudne"];
    let diff = diff_options.choose(&mut rng).unwrap();

    let filtered: Vec<&str> = all
        .iter()
        .copied()
        .filter(|c| get_difficulty(c) == *diff)
        .collect();

    let pool = if filtered.len() >= 2 {
        filtered
    } else {
        all.to_vec()
    };

    let mut local = pool.clone();
    local.shuffle(&mut rng);

    let c1 = local.get(0).unwrap_or(&all[0]).to_string();
    let c2 = local
        .get(1)
        .unwrap_or(&all[1.min(all.len() - 1)])
        .to_string();

    (c1, c2)
}

fn assign_lines() -> (Vec<usize>, Vec<(usize, String)>) {
    let mut rng = rand::thread_rng();
    let mut players = vec![1, 2, 3, 4, 5];
    players.shuffle(&mut rng);
    let chosen = players[..2].to_vec();

    let mut lanes = VIRTUAL_ROLES.to_vec();
    lanes.shuffle(&mut rng);

    let lane_map = vec![
        (chosen[0], lanes[0].to_string()),
        (chosen[1], lanes[1].to_string()),
    ];

    (chosen, lane_map)
}

fn draw_from_pool(pool: &[&str], count: usize) -> Vec<String> {
    let mut v = pool.to_vec();
    let mut rng = rand::thread_rng();
    v.shuffle(&mut rng);
    v.into_iter().take(count).map(|s| s.to_string()).collect()
}

fn draw_items(players_with_lines: &[usize]) -> Vec<(usize, String)> {
    let items = draw_from_pool(&ITEMS, players_with_lines.len());
    players_with_lines
        .iter()
        .cloned()
        .zip(items.into_iter())
        .collect()
}

fn draw_summoners(players_with_lines: &[usize]) -> Vec<(usize, String)> {
    let mut rng = rand::thread_rng();
    players_with_lines
        .iter()
        .map(|p| {
            let spell = SUMMONER_SPELLS.choose(&mut rng).unwrap().to_string();
            (*p, spell)
        })
        .collect()
}


fn draw_champions(players_without_lines: &[usize], used: &mut HashSet<String>) -> Vec<(usize, (String, String))>{
    let mut rng = rand::thread_rng();
    let mut champs: Vec<&str> = CHAMPIONS
        .iter()
        .copied()
        .filter(|champ| !used.contains(*champ))
        .collect();
    champs.shuffle(&mut rng);

    let mut result = Vec::new();
    let mut idx = 0;

    for p in players_without_lines {
        if idx + 1 >= champs.len() {
            break;
        }

        let c1 = champs[idx];
        let mut c2 = champs[idx + 1];

        if get_virtual_role(c1) == get_virtual_role(c2) {
            for swap_idx in (idx + 2)..champs.len() {
                if get_virtual_role(champs[swap_idx]) != get_virtual_role(c1) {
                    champs.swap(idx + 1, swap_idx);
                    c2 = champs[idx + 1];
                    break;
                }
            }
        }

        result.push((*p, (c1.to_string(), c2.to_string())));
        used.insert(c1.to_string());
        used.insert(c2.to_string());
        idx += 2;
    }

    result
}

#[derive(Serialize)]
pub struct PlayerLine {
    pub player_index: usize,
    pub lane: String,
    pub item: Option<String>,
    pub summoner: Option<String>,
    pub champs: Option<(String, String)>,
}

#[derive(Serialize)]
pub struct TeamDraft {
    pub side: String,
    pub icon: String,
    pub players: Vec<PlayerLine>,
    pub team_challenge: String,
    pub solo_challenge: String,
    pub solo_player_index: usize,
}

#[derive(Serialize)]
pub struct DraftResult {
    pub blue: TeamDraft,
    pub red: TeamDraft,
}

pub fn generate_draft_internal() -> DraftResult {
    let mut rng = rand::thread_rng();
    let all_players = vec![1, 2, 3, 4, 5];

    // WSPÓLNA PULA UŻYTYCH CHAMPIONÓW
    let mut used_champions: HashSet<String> = HashSet::new();

    // LOSOWANIE ZADAŃ (TA SAMA TRUDNOŚĆ DLA OBU DRUŻYN)
    let (blue_team_ch, red_team_ch) = pick_challenge_for_both(&TEAM_CHALLENGES);
    let (blue_solo_ch, red_solo_ch) = pick_challenge_for_both(&SOLO_CHALLENGES);

    let blue_solo_player = rng.gen_range(1..=5);
    let red_solo_player = rng.gen_range(1..=5);

    // BLUE SIDE
    let (blue_with_lines, blue_lane_map_raw) = assign_lines();
    let blue_items = draw_items(&blue_with_lines);
    let blue_summoners = draw_summoners(&blue_with_lines);
    let blue_without: Vec<usize> = all_players
        .iter()
        .filter(|p| !blue_with_lines.contains(p))
        .cloned()
        .collect();

    // POPRAWKA: przekazujemy used_champions
    let blue_champs = draw_champions(&blue_without, &mut used_champions);

    let mut blue_players = Vec::new();
    for p in &all_players {
        let lane = blue_lane_map_raw
            .iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, l)| l.clone());

        let item = blue_items
            .iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, it)| it.clone());

        let summoner = blue_summoners
            .iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, s)| s.clone());

        let champs = blue_champs
            .iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, pair)| pair.clone());

        blue_players.push(PlayerLine {
            player_index: *p,
            lane: lane.unwrap_or_default(),
            item,
            summoner,
            champs,
        });
    }

    // RED SIDE
    let (red_with_lines, red_lane_map_raw) = assign_lines();
    let red_items = draw_items(&red_with_lines);
    let red_summoners = draw_summoners(&red_with_lines);
    let red_without: Vec<usize> = all_players
        .iter()
        .filter(|p| !red_with_lines.contains(p))
        .cloned()
        .collect();

    // POPRAWKA: przekazujemy used_champions
    let red_champs = draw_champions(&red_without, &mut used_champions);

    let mut red_players = Vec::new();
    for p in &all_players {
        let lane = red_lane_map_raw
            .iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, l)| l.clone());

        let item = red_items
            .iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, it)| it.clone());

        let summoner = red_summoners
            .iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, s)| s.clone());

        let champs = red_champs
            .iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, pair)| pair.clone());

        red_players.push(PlayerLine {
            player_index: *p,
            lane: lane.unwrap_or_default(),
            item,
            summoner,
            champs,
        });
    }

    DraftResult {
        blue: TeamDraft {
            side: "BLUE".to_string(),
            icon: "🔵".to_string(),
            players: blue_players,
            team_challenge: blue_team_ch,
            solo_challenge: blue_solo_ch,
            solo_player_index: blue_solo_player,
        },
        red: TeamDraft {
            side: "RED".to_string(),
            icon: "🔴".to_string(),
            players: red_players,
            team_challenge: red_team_ch,
            solo_challenge: red_solo_ch,
            solo_player_index: red_solo_player,
        },
    }
}


// -------------------------------------------------------------
// STAN APLIKACJI I HISTORIA GIER
// -------------------------------------------------------------

#[derive(Serialize, Deserialize)]
pub struct GameRecord {
    pub timestamp: String,
    pub winner: String,
    pub draft: serde_json::Value,
    pub points: serde_json::Value,
    pub players_blue: Vec<String>,
    pub players_red: Vec<String>,
    // wybrane champy pod statystyki championów
    pub chosen_blue: Vec<String>, // 5 elementów, może być "" jeśli nie wybrano
    pub chosen_red: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct AppState {
    pub players_blue: Vec<String>,
    pub players_red: Vec<String>,
    pub games: Vec<GameRecord>,
}

impl AppState {
    fn default() -> Self {
        Self {
            players_blue: vec![
                "Gracz1".to_string(),
                "Gracz2".to_string(),
                "Gracz3".to_string(),
                "Gracz4".to_string(),
                "Gracz5".to_string(),
            ],
            players_red: vec![
                "Gracz1".to_string(),
                "Gracz2".to_string(),
                "Gracz3".to_string(),
                "Gracz4".to_string(),
                "Gracz5".to_string(),
            ],
            games: Vec::new(),
        }
    }
}

fn get_state_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("Could not get app_data_dir");

    if !dir.exists() {
        std::fs::create_dir_all(&dir).expect("Could not create app_data_dir");
    }

    dir.join("state.json")
}

fn load_state(app: &tauri::AppHandle) -> AppState {
    let path = get_state_path(app);
    if !path.exists() {
        return AppState::default();
    }

    let data = fs::read_to_string(path).unwrap_or_default();
    if data.is_empty() {
        return AppState::default();
    }

    serde_json::from_str::<AppState>(&data).unwrap_or_else(|_| AppState::default())
}

fn save_state(app: &tauri::AppHandle, state: &AppState) {
    let path = get_state_path(app);
    let json = serde_json::to_string_pretty(state).unwrap();
    fs::write(path, json).unwrap();
}

// -------------------------------------------------------------
// KOMENDY TAURI
// -------------------------------------------------------------

#[tauri::command]
pub fn save_game_result(
    app: tauri::AppHandle,
    winner: String,
    draft: serde_json::Value,
    points: serde_json::Value,
    players_blue: Vec<String>,
    players_red: Vec<String>,
    chosen_blue: Vec<String>,
    chosen_red: Vec<String>,
) -> Result<(), String> {
    let mut state = load_state(&app);

    if players_blue.len() == 5 {
        state.players_blue = players_blue;
    }
    if players_red.len() == 5 {
        state.players_red = players_red;
    }

    let cb = if chosen_blue.len() == 5 {
        chosen_blue
    } else {
        vec!["".to_string(); 5]
    };
    let cr = if chosen_red.len() == 5 {
        chosen_red
    } else {
        vec!["".to_string(); 5]
    };

    let record = GameRecord {
        timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M").to_string(),
        winner,
        draft,
        points,
        players_blue: state.players_blue.clone(),
        players_red: state.players_red.clone(),
        chosen_blue: cb,
        chosen_red: cr,
    };

    state.games.push(record);
    save_state(&app, &state);

    Ok(())
}

#[tauri::command]
pub fn load_history(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let state = load_state(&app);
    Ok(serde_json::json!(state))
}

#[tauri::command]
pub fn set_players(
    app: tauri::AppHandle,
    players_blue: Vec<String>,
    players_red: Vec<String>,
) -> Result<(), String> {
    let mut state = load_state(&app);

    if players_blue.len() == 5 {
        state.players_blue = players_blue;
    }

    if players_red.len() == 5 {
        state.players_red = players_red;
    }

    save_state(&app, &state);
    Ok(())
}

// reset ranking = wyczyszczenie gier
#[tauri::command]
pub fn reset_ranking(app: tauri::AppHandle) -> Result<(), String> {
    let mut state = load_state(&app);
    state.games.clear();
    save_state(&app, &state);
    Ok(())
}

// reset rotacji – placeholder (logika po stronie frontu / do rozbudowy)
#[tauri::command]
pub fn reset_rotation(_app: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

// -------------------------------------------------------------
// EKSPORT DWÓCH PLIKÓW (BLUE/RED) NA PULPIT
// -------------------------------------------------------------

fn get_export_dir(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(desktop) = app.path().desktop_dir() {
        return desktop;
    }
    if let Ok(home) = app.path().home_dir() {
        return home;
    }
    std::env::temp_dir()
}

fn next_export_filename(dir: &PathBuf, prefix: &str) -> PathBuf {
    let mut i = 1;
    loop {
        let candidate = dir.join(format!("{prefix}_{i}.txt"));
        if !candidate.exists() {
            return candidate;
        }
        i += 1;
    }
}

#[tauri::command]
pub fn export_teams(
    app: tauri::AppHandle,
    blue_text: String,
    red_text: String,
) -> Result<(String, String), String> {
    let dir = get_export_dir(&app);

    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    let blue_path = next_export_filename(&dir, "Blue_Side");
    let red_path = next_export_filename(&dir, "Red_Side");

    fs::write(&blue_path, blue_text).map_err(|e| e.to_string())?;
    fs::write(&red_path, red_text).map_err(|e| e.to_string())?;

    Ok((
        blue_path.to_string_lossy().to_string(),
        red_path.to_string_lossy().to_string(),
    ))
}
