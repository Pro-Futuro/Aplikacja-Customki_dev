use rand::seq::SliceRandom;
use rand::Rng;

const VIRTUAL_ROLES: [&str; 5] = ["Top", "Jungle", "Mid", "ADC", "Support"];

const SUMMONER_SPELLS: [&str; 8] = [
    "Ignite","Teleport","Heal","Barrier",
    "Exhaust","Ghost","Cleanse","Clarity"
];

const SOLO_CHALLENGES: [&str; 19] = [
    "Zadaj 30 000 obrażeń w grze. (Średnie)",
    "Zdobądź 3 kille przed 10. minutą. (Średnie)",
    "Nie zgiń przez pierwsze 15 minut gry. (Średnie)",
    "Zdobądź pierwszą krew (First Blood). (Łatwe)",
    "Zrób co najmniej 15 asyst. (Łatwe)",
    "Zrób quadra kill lub pentakill. (Trudne)",
    "Miej więcej farmy niż przeciwnik na swojej linii do 15. minuty. (Łatwe)",
    "Nie oddaj żadnej wieży na swojej linii do 15. minuty. (Średnie)",
    "Zdobądź vision score mniejszy niż 10. (Średnie)",
    "Nie wracaj do bazy przed 10. minutą. (Średnie)",
    "Nie używaj ultimate przez całą grę. (Trudne)",
    "Kup tylko przedmioty z maną. (Średnie)",
    "Nie kupuj żadnych przedmiotów defensywnych. (Średnie)",
    "Zagraj całą grę bez butów. (Średnie)",
    "Kupuj tylko przedmioty z aktywem. (Trudne)",
    "Zdobądź ostatni kill w grze. (Średnie)",
    "Postaw control warda na fontannie przeciwnika. (Średnie)",
    "Wygraj grę bez killa. (Trudne)",
    "Wygraj grę z perfect KDA. (Trudne)"
];

const TEAM_CHALLENGES: [&str; 9] = [
    "Wszyscy mają mieć te same buty. (Łatwe)",
    "Każdy musi mieć ten sam trinket. (Łatwe)",
    "Wygraj grę bez oddania smoka. (Trudne)",
    "Zniszcz wieżę przed 10 minutą. (Średnie)",
    "Wszyscy grają bez ultimate. (Trudne)",
    "Cała drużyna bez przedmiotów defensywnych. (Trudne)",
    "Cała gra bez recall. (Trudne)",
    "Tematyczna drużyna. (Łatwe)",
    "Zniszcz inhiba przed 18 minutą. (Średnie)"
];

// UWAGA: tutaj wkleimy pełne listy ITEMS i CHAMPIONS z Pythona.
// Na początek możesz zacząć od kilku, a potem rozszerzyć.

const ITEMS: [&str; 10] = [
    "Abyssal Mask","Actualizer","Archangel's Staff","Ardent Censer","Axiom Arc",
    "Bandlepipes","Banshee's Veil","Bastionbreaker","Black Cleaver","Blackfire Torch"
];

const CHAMPIONS: [&str; 10] = [
    "Aatrox","Ahri","Akali","Akshan","Alistar",
    "Amumu","Anivia","Annie","Aphelios","Ashe"
];

fn get_virtual_role(champion: &str) -> &'static str {
    let idx = (seahash::hash(champion.as_bytes()) as usize) % VIRTUAL_ROLES.len();
    VIRTUAL_ROLES[idx]
}

fn get_difficulty(challenge: &str) -> &'static str {
    let t = challenge.to_lowercase();
    if t.contains("trudne") { "Trudne" }
    else if t.contains("średnie") { "Średnie" }
    else if t.contains("łatwe") { "Łatwe" }
    else { "Inne" }
}

fn pick_two_challenges_same_difficulty(all: &[&str]) -> (String, String) {
    let mut rng = rand::thread_rng();
    let diff_options = ["Łatwe","Średnie","Trudne"];
    let diff = diff_options.choose(&mut rng).unwrap();

    let filtered: Vec<&str> = all.iter()
        .copied()
        .filter(|c| get_difficulty(c) == *diff)
        .collect();

    let pool = if filtered.len() >= 2 { filtered } else { all.to_vec() };
    let mut local = pool.clone();
    local.shuffle(&mut rng);

    let c1 = local.get(0).unwrap_or(&all[0]).to_string();
    let c2 = local.get(1).unwrap_or(&all[1.min(all.len()-1)]).to_string();

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
        (chosen[1], lanes[1].to_string())
    ];

    (chosen, lane_map)
}

fn draw_from_pool(pool: &[&str], count: usize) -> Vec<String> {
    let mut rng = rand::thread_rng();
    let mut v = pool.to_vec();
    v.shuffle(&mut rng);
    v.into_iter().take(count).map(|s| s.to_string()).collect()
}

fn draw_items(players_with_lines: &[usize]) -> Vec<(usize, String)> {
    let items = draw_from_pool(&ITEMS, players_with_lines.len());
    players_with_lines.iter().cloned().zip(items.into_iter()).collect()
}

fn draw_summoners(players_with_lines: &[usize]) -> Vec<(usize, String)> {
    let mut rng = rand::thread_rng();
    players_with_lines.iter().map(|p| {
        let spell = SUMMONER_SPELLS.choose(&mut rng).unwrap().to_string();
        (*p, spell)
    }).collect()
}

fn draw_champions(players_without_lines: &[usize]) -> Vec<(usize, (String, String))> {
    let mut rng = rand::thread_rng();
    let mut champs = CHAMPIONS.to_vec();
    champs.shuffle(&mut rng);

    let mut result = Vec::new();
    let mut idx = 0;

    for p in players_without_lines {
        if idx + 1 >= champs.len() { break; }

        let mut c1 = champs[idx];
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
        idx += 2;
    }

    result
}

#[derive(serde::Serialize)]
pub struct PlayerLine {
    pub player_index: usize,
    pub lane: String,
    pub item: Option<String>,
    pub summoner: Option<String>,
    pub champs: Option<(String, String)>,
}

#[derive(serde::Serialize)]
pub struct TeamDraft {
    pub side: String,
    pub icon: String,
    pub players: Vec<PlayerLine>,
    pub team_challenge: String,
    pub solo_challenge: String,
    pub solo_player_index: usize,
}

#[derive(serde::Serialize)]
pub struct DraftResult {
    pub blue: TeamDraft,
    pub red: TeamDraft,
}

pub fn generate_draft_internal() -> DraftResult {
    let mut rng = rand::thread_rng();
    let all_players = vec![1,2,3,4,5];

    // BLUE
    let (blue_with_lines, blue_lane_map_raw) = assign_lines();
    let blue_items = draw_items(&blue_with_lines);
    let blue_summoners = draw_summoners(&blue_with_lines);
    let blue_without: Vec<usize> = all_players.iter()
        .filter(|p| !blue_with_lines.contains(p))
        .cloned()
        .collect();
    let blue_champs = draw_champions(&blue_without);

    let (blue_team_ch, _) = pick_two_challenges_same_difficulty(&TEAM_CHALLENGES);
    let (blue_solo_ch, _) = pick_two_challenges_same_difficulty(&SOLO_CHALLENGES);
    let blue_solo_player = rng.gen_range(1..=5);

    let mut blue_players = Vec::new();
    for p in &all_players {
        let lane = blue_lane_map_raw.iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, l)| l.clone());

        let item = blue_items.iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, it)| it.clone());

        let summoner = blue_summoners.iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, s)| s.clone());

        let champs = blue_champs.iter()
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

    // RED – analogicznie, ale niezależnie
    let (red_with_lines, red_lane_map_raw) = assign_lines();
    let red_items = draw_items(&red_with_lines);
    let red_summoners = draw_summoners(&red_with_lines);
    let red_without: Vec<usize> = all_players.iter()
        .filter(|p| !red_with_lines.contains(p))
        .cloned()
        .collect();
    let red_champs = draw_champions(&red_without);

    let (red_team_ch, _) = pick_two_challenges_same_difficulty(&TEAM_CHALLENGES);
    let (red_solo_ch, _) = pick_two_challenges_same_difficulty(&SOLO_CHALLENGES);
    let red_solo_player = rng.gen_range(1..=5);

    let mut red_players = Vec::new();
    for p in &all_players {
        let lane = red_lane_map_raw.iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, l)| l.clone());

        let item = red_items.iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, it)| it.clone());

        let summoner = red_summoners.iter()
            .find(|(idx, _)| idx == p)
            .map(|(_, s)| s.clone());

        let champs = red_champs.iter()
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
            side: "Blue Side".to_string(),
            icon: "🔵".to_string(),
            players: blue_players,
            team_challenge: blue_team_ch,
            solo_challenge: blue_solo_ch,
            solo_player_index: blue_solo_player,
        },
        red: TeamDraft {
            side: "Red Side".to_string(),
            icon: "🔴".to_string(),
            players: red_players,
            team_challenge: red_team_ch,
            solo_challenge: red_solo_ch,
            solo_player_index: red_solo_player,
        }
    }
}
