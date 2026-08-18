use std::{thread, time::Duration};

use tauri::{AppHandle, Manager, Runtime};

const SECOND_INSTANCE_RETRIES: usize = 20;
const SECOND_INSTANCE_RETRY_DELAY: Duration = Duration::from_millis(50);

fn restore_main_window<R: Runtime>(app: &AppHandle<R>) -> bool {
    let Some(window) = app.get_webview_window("main") else {
        return false;
    };

    window.show().is_ok() && window.unminimize().is_ok() && window.set_focus().is_ok()
}

fn restore_main_window_with_retry<R: Runtime + 'static>(app: AppHandle<R>) {
    thread::spawn(move || {
        for attempt in 0..SECOND_INSTANCE_RETRIES {
            if restore_main_window(&app) {
                return;
            }
            if attempt + 1 < SECOND_INSTANCE_RETRIES {
                thread::sleep(SECOND_INSTANCE_RETRY_DELAY);
            }
        }

        eprintln!(
            "Desk: second-instance window restore failed after {SECOND_INSTANCE_RETRIES} attempts"
        );
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            restore_main_window_with_retry(app.clone());
        }))
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
