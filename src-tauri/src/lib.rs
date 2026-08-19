use std::{path::Path, thread, time::Duration};

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

fn open_path(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|err| err.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|err| err.to_string())?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = path;
        Err("Opening the data folder is not supported on this system.".into())
    }
}

#[tauri::command]
fn open_data_folder(app: AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|err| err.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    open_path(&dir)
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
        .invoke_handler(tauri::generate_handler![open_data_folder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
