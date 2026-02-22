use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    
    #[error("Keyring error: {0}")]
    Keyring(#[from] keyring::Error),
    
    #[error("SSH error: {0}")]
    Ssh(#[from] ssh2::Error),
    
    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    
    #[error("App error: {0}")]
    Custom(String),
}

// Implement Serialize so we can return Result<T, AppError> from Tauri commands
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
