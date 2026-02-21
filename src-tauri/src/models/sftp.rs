use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileProperties {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_at: u64,
    /// Octal mode e.g. 493 (= 0o755)
    pub permissions: u32,
    /// Display string e.g. "rwxr-xr-x"
    pub permissions_display: String,
    pub uid: u32,
    pub gid: u32,
}

pub fn mode_to_display(mode: u32) -> String {
    let bits = [
        (0o400, 'r'), (0o200, 'w'), (0o100, 'x'),
        (0o040, 'r'), (0o020, 'w'), (0o010, 'x'),
        (0o004, 'r'), (0o002, 'w'), (0o001, 'x'),
    ];
    bits.iter().map(|(mask, ch)| if mode & mask != 0 { *ch } else { '-' }).collect()
}
