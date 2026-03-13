#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[path = "../../src/logic.rs"]
mod logic;

#[tauri::command]
fn generate_draft() -> logic::DraftResult {
    logic::generate_draft_internal()
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            generate_draft,
            logic::save_game_result,
            logic::load_history,
            logic::set_players,
            logic::reset_ranking,
            logic::reset_rotation,
            logic::export_teams,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
