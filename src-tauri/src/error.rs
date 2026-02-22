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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_error_io() {
        let err = AppError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "file not found",
        ));
        let msg = err.to_string();
        assert!(msg.contains("IO error"));
        assert!(msg.contains("file not found"));
    }

    #[test]
    fn test_app_error_custom() {
        let err = AppError::Custom("Something went wrong".to_string());
        let msg = err.to_string();
        assert_eq!(msg, "App error: Something went wrong");
    }

    #[test]
    fn test_app_error_from_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "access denied");
        let app_err: AppError = io_err.into();

        assert!(matches!(app_err, AppError::Io(_)));
    }

    #[test]
    fn test_app_error_from_serde_json() {
        let json_err = serde_json::from_str::<i32>("not a number").unwrap_err();
        let app_err: AppError = json_err.into();

        assert!(matches!(app_err, AppError::Serde(_)));
    }

    #[test]
    fn test_result_ok() {
        let result: Result<i32> = Ok(42);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[test]
    fn test_result_err() {
        let result: Result<i32> = Err(AppError::Custom("test error".to_string()));
        assert!(result.is_err());
    }

    #[test]
    fn test_app_error_serialization() {
        let err = AppError::Custom("test".to_string());
        let json = serde_json::to_string(&err).unwrap();

        assert!(json.contains("test"));
    }

    #[test]
    fn test_app_error_debug() {
        let err = AppError::Custom("debug test".to_string());
        let debug_str = format!("{:?}", err);

        assert!(debug_str.contains("Custom"));
    }
}
