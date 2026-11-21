use std::{env, fs, path::PathBuf};

/// Resolve the folder where all app data lives.
/// Portable mode: a `LocalMind-data` folder next to the executable.
/// Fallback: %APPDATA%\LocalMind (or $HOME/LocalMind) if the exe folder is read-only.
pub fn data_dir() -> PathBuf {
    if let Ok(exe) = env::current_exe() {
        if let Some(parent) = exe.parent() {
            let candidate = parent.join("LocalMind-data");
            if fs::create_dir_all(&candidate).is_ok() {
                let probe = candidate.join(".write_probe");
                if fs::write(&probe, b"ok").is_ok() {
                    let _ = fs::remove_file(&probe);
                    return candidate;
                }
            }
        }
    }

    let base = env::var("APPDATA")
        .map(PathBuf::from)
        .or_else(|_| env::var("HOME").map(PathBuf::from))
        .unwrap_or_else(|_| PathBuf::from("."));
    let fallback = base.join("LocalMind");
    let _ = fs::create_dir_all(&fallback);
    fallback
}

pub fn db_path() -> PathBuf {
    data_dir().join("localmind.db")
}

pub fn attachments_dir() -> PathBuf {
    let dir = data_dir().join("attachments");
    let _ = fs::create_dir_all(&dir);
    dir
}
