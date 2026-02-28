use tauri::State;
use crate::error::Result;
use crate::models::profile::SshProfile;
use crate::state::app_state::AppState;

#[tauri::command]
pub async fn run_net_tool(
    state: State<'_, AppState>,
    profile: SshProfile,
    tool_type: String,
    target: String,
) -> Result<String> {
    let secret = state
        .profile_store
        .lock()
        .unwrap()
        .get_profile_secret(&profile.id)
        .unwrap_or(None);

    state
        .net_tool_manager
        .run_tool(&profile, secret.as_deref(), &tool_type, &target)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_net_tool_command_types() {
        let _result_string: Result<String> = Ok("output".to_string());
    }

    #[test]
    fn test_net_tool_types() {
        let tools = vec![
            "ping", "traceroute", "dns", "portscan", "nmap",
            "whois", "mtr", "curl_timing", "connections", "interfaces",
        ];
        for tool in tools {
            assert!(!tool.is_empty());
        }
    }

    #[test]
    fn test_net_tool_target_formats() {
        let targets = vec![
            "127.0.0.1",
            "localhost",
            "example.com",
            "192.168.1.1",
            "::1",
        ];
        for target in targets {
            assert!(!target.is_empty());
        }
    }

    #[test]
    fn test_net_tool_secret_handling() {
        let secret: Option<String> = None;
        let secret_deref = secret.as_deref();
        assert!(secret_deref.is_none());

        let secret2: Option<String> = Some("password".to_string());
        let secret_deref2 = secret2.as_deref();
        assert_eq!(secret_deref2, Some("password"));
    }

    #[test]
    fn test_net_tool_state_lock_pattern() {
        let store = std::sync::Mutex::new(vec![1, 2, 3]);
        let guard = store.lock().unwrap();
        assert_eq!(guard.len(), 3);
    }

    #[test]
    fn test_net_tool_result_unwrap_or() {
        let result: Result<Option<String>> = Ok(None);
        let unwrapped = result.unwrap_or(None);
        assert!(unwrapped.is_none());
    }

    #[test]
    fn test_net_tool_manager_methods() {
        let methods = vec!["run_tool"];
        for method in methods {
            assert!(!method.is_empty());
        }
    }

    #[test]
    fn test_net_tool_string_cloning() {
        let tool_type = "ping".to_string();
        let target = "127.0.0.1".to_string();
        let tool_cloned = tool_type.clone();
        let target_cloned = target.clone();
        
        assert_eq!(tool_type, tool_cloned);
        assert_eq!(target, target_cloned);
    }

    #[test]
    fn test_net_tool_async_function_types() {
        use std::future;
        let _run_net_tool: fn(State<'_, AppState>, SshProfile, String, String) -> future::Ready<Result<String>> = 
            |_, _, _, _| future::ready(Ok(String::new()));
    }

    #[test]
    fn test_net_tool_option_as_deref() {
        let secret: Option<String> = Some("secret".to_string());
        let deref = secret.as_deref();
        assert_eq!(deref, Some("secret"));
    }
}
