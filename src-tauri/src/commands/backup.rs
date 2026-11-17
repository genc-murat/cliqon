use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use tauri::State;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{profile::SshProfile, snippet::Snippet};
use crate::state::app_state::AppState;

#[derive(Deserialize, Serialize)]
pub struct BackupRecords {
    profiles: Vec<SshProfile>,
    snippets: Vec<Snippet>,
}

#[tauri::command]
pub async fn export_backup_records(state: State<'_, AppState>) -> Result<BackupRecords> {
    let profiles = state.profile_store.lock().unwrap();
    let snippets = state.snippet_store.lock().unwrap();
    Ok(BackupRecords {
        profiles: profiles
            .get_all_profiles()?
            .into_iter()
            .map(SshProfile::without_secret)
            .collect(),
        snippets: snippets.get_all()?,
    })
}

#[tauri::command]
pub async fn restore_backup_records(
    state: State<'_, AppState>,
    records: BackupRecords,
) -> Result<HashMap<String, String>> {
    let mut profile_ids = HashSet::new();
    let mut snippet_ids = HashSet::new();
    if records.profiles.iter().any(|profile| {
        profile.id.is_empty()
            || profile.host.trim().is_empty()
            || profile.username.trim().is_empty()
            || profile.port == 0
            || !profile_ids.insert(&profile.id)
    }) || records
        .snippets
        .iter()
        .any(|snippet| snippet.id.is_empty() || !snippet_ids.insert(&snippet.id))
    {
        return Err(AppError::Custom(
            "Backup contains an invalid SSH profile or snippet".into(),
        ));
    }

    let profile_store = state.profile_store.lock().unwrap();
    let snippet_store = state.snippet_store.lock().unwrap();
    let previous_profiles = profile_store.get_all_profiles()?;
    let mut profiles = previous_profiles.clone();
    let mut snippets = snippet_store.get_all()?;
    let update_profiles = !records.profiles.is_empty();
    let update_snippets = !records.snippets.is_empty();
    let profile_ids = merge_profiles(&mut profiles, records.profiles);
    for snippet in records.snippets {
        if let Some(position) = snippets
            .iter()
            .position(|existing| existing.id == snippet.id)
        {
            snippets[position] = snippet;
        } else {
            snippets.push(snippet);
        }
    }

    if update_profiles {
        profile_store.save_profiles(&profiles)?;
    }
    if update_snippets {
        if let Err(error) = snippet_store.save_all(&snippets) {
            if update_profiles {
                profile_store
                    .save_profiles(&previous_profiles)
                    .map_err(|rollback| {
                        AppError::Custom(format!("{error}. Profile rollback failed: {rollback}"))
                    })?;
            }
            return Err(error);
        }
    }
    Ok(profile_ids)
}

fn merge_profiles(
    profiles: &mut Vec<SshProfile>,
    imported: Vec<SshProfile>,
) -> HashMap<String, String> {
    let mut profile_ids = HashMap::new();

    for mut profile in imported.into_iter().map(SshProfile::without_secret) {
        let source_id = profile.id.clone();
        if let Some(position) = profiles
            .iter()
            .position(|existing| existing.id == source_id)
        {
            let existing = &profiles[position];
            if existing.same_credentials_scope(&profile) {
                profile.obfuscated_secret = existing.obfuscated_secret.clone();
                profiles[position] = profile;
                continue;
            }

            // Copy the restored connection so the local credential remains scoped to its server.
            if let Some(position) = profiles.iter().position(|existing| {
                existing.same_credentials_scope(&profile) && existing.name == profile.name
            }) {
                let existing = &profiles[position];
                profile.id = existing.id.clone();
                profile.obfuscated_secret = existing.obfuscated_secret.clone();
                profile_ids.insert(source_id, profile.id.clone());
                profiles[position] = profile;
                continue;
            }
            profile.id = Uuid::new_v4().to_string();
            profile_ids.insert(source_id, profile.id.clone());
        }
        profiles.push(profile);
    }
    profile_ids
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restore_preserves_local_credentials_and_copies_a_conflicting_endpoint() {
        let local = SshProfile {
            host: "current.example.test".into(),
            obfuscated_secret: Some("legacy-local".into()),
            ..SshProfile::default()
        };
        let renamed = SshProfile {
            name: "Renamed in the backup".into(),
            obfuscated_secret: Some("ignored".into()),
            ..local.clone()
        };
        let mut profiles = vec![local.clone()];
        assert!(merge_profiles(&mut profiles, vec![renamed.clone()]).is_empty());
        assert_eq!(profiles[0].name, renamed.name);
        assert_eq!(profiles[0].obfuscated_secret, local.obfuscated_secret);

        let different_host = SshProfile {
            host: "backup.example.test".into(),
            ..renamed
        };
        let ids = merge_profiles(&mut profiles, vec![different_host.clone()]);
        assert_eq!(profiles.len(), 2);
        assert_eq!(profiles[0].host, local.host);
        assert_eq!(profiles[1].id, ids[&local.id]);
        assert!(profiles[1].obfuscated_secret.is_none());

        let repeated = merge_profiles(&mut profiles, vec![different_host]);
        assert_eq!(repeated, ids);
        assert_eq!(profiles.len(), 2);
    }
}
