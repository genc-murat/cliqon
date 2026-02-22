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
        (0o400, 'r'),
        (0o200, 'w'),
        (0o100, 'x'),
        (0o040, 'r'),
        (0o020, 'w'),
        (0o010, 'x'),
        (0o004, 'r'),
        (0o002, 'w'),
        (0o001, 'x'),
    ];
    bits.iter()
        .map(|(mask, ch)| if mode & mask != 0 { *ch } else { '-' })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mode_to_display_755() {
        assert_eq!(mode_to_display(0o755), "rwxr-xr-x");
    }

    #[test]
    fn test_mode_to_display_644() {
        assert_eq!(mode_to_display(0o644), "rw-r--r--");
    }

    #[test]
    fn test_mode_to_display_777() {
        assert_eq!(mode_to_display(0o777), "rwxrwxrwx");
    }

    #[test]
    fn test_mode_to_display_000() {
        assert_eq!(mode_to_display(0o000), "---------");
    }

    #[test]
    fn test_mode_to_display_600() {
        assert_eq!(mode_to_display(0o600), "rw-------");
    }

    #[test]
    fn test_mode_to_display_700() {
        assert_eq!(mode_to_display(0o700), "rwx------");
    }

    #[test]
    fn test_mode_to_display_400() {
        assert_eq!(mode_to_display(0o400), "r--------");
    }

    #[test]
    fn test_file_node_serialization() {
        let node = FileNode {
            name: "test.txt".to_string(),
            path: "/home/user/test.txt".to_string(),
            is_dir: false,
            size: 1024,
            modified_at: 1234567890,
        };

        let json = serde_json::to_string(&node).unwrap();
        let decoded: FileNode = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.name, node.name);
        assert_eq!(decoded.path, node.path);
        assert_eq!(decoded.is_dir, false);
        assert_eq!(decoded.size, 1024);
    }

    #[test]
    fn test_file_properties_serialization() {
        let props = FileProperties {
            name: "script.sh".to_string(),
            path: "/usr/local/bin/script.sh".to_string(),
            is_dir: false,
            size: 512,
            modified_at: 1609459200,
            permissions: 0o755,
            permissions_display: "rwxr-xr-x".to_string(),
            uid: 1000,
            gid: 1000,
        };

        let json = serde_json::to_string(&props).unwrap();
        let decoded: FileProperties = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.permissions, 0o755);
        assert_eq!(decoded.uid, 1000);
    }
}
