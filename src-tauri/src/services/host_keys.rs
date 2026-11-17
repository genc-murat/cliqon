use std::collections::BTreeMap;
use std::fs;
use std::net::{TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine as _};
use serde::Serialize;
use sha2::{Digest, Sha256};
use ssh2::Session;

use crate::error::{AppError, Result};
use crate::models::profile::SshProfile;

static HOST_KEYS: OnceLock<HostKeys> = OnceLock::new();
const TCP_TIMEOUT: Duration = Duration::from_secs(10);
const SSH_TIMEOUT: Duration = Duration::from_secs(15);

struct HostKeys {
    path: PathBuf,
    lock: Mutex<()>,
}

#[derive(Serialize)]
pub struct HostKeyInfo {
    endpoint: String,
    fingerprint: String,
    algorithm: String,
    trusted: bool,
}

pub fn initialize(path: PathBuf) {
    let _ = HOST_KEYS.set(HostKeys {
        path,
        lock: Mutex::new(()),
    });
}

fn store() -> Result<&'static HostKeys> {
    HOST_KEYS
        .get()
        .ok_or_else(|| AppError::Custom("SSH host key store is unavailable".into()))
}

fn hostname(profile: &SshProfile) -> &str {
    let host = profile.host.trim();
    host.strip_prefix('[')
        .and_then(|host| host.strip_suffix(']'))
        .unwrap_or(host)
}

fn endpoint(profile: &SshProfile) -> String {
    format!(
        "[{}]:{}",
        hostname(profile).to_ascii_lowercase(),
        profile.port
    )
}

pub fn connect_tcp(profile: &SshProfile) -> Result<TcpStream> {
    let addresses = (hostname(profile), profile.port).to_socket_addrs()?;
    let deadline = std::time::Instant::now() + TCP_TIMEOUT;
    let mut last_error = None;
    for address in addresses {
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        if remaining.is_zero() {
            break;
        }
        match TcpStream::connect_timeout(&address, remaining) {
            Ok(stream) => {
                stream.set_read_timeout(Some(SSH_TIMEOUT))?;
                stream.set_write_timeout(Some(SSH_TIMEOUT))?;
                return Ok(stream);
            }
            Err(error) => last_error = Some(error),
        }
    }
    Err(last_error
        .unwrap_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Could not resolve the SSH host",
            )
        })
        .into())
}

pub fn handshake(stream: TcpStream) -> Result<Session> {
    let mut session = Session::new()?;
    session.set_timeout(SSH_TIMEOUT.as_millis() as u32);
    session.set_tcp_stream(stream);
    session.handshake()?;
    Ok(session)
}

fn fingerprint(session: &Session) -> Result<(String, String)> {
    let (key, kind) = session
        .host_key()
        .ok_or_else(|| AppError::Custom("The SSH server did not present a host key".into()))?;
    let hash = STANDARD_NO_PAD.encode(Sha256::digest(key));
    Ok((format!("SHA256:{hash}"), format!("{kind:?}")))
}

impl HostKeys {
    fn read(&self) -> Result<BTreeMap<String, String>> {
        match fs::read(&self.path) {
            Ok(bytes) => Ok(serde_json::from_slice(&bytes)?),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(BTreeMap::new()),
            Err(error) => Err(error.into()),
        }
    }

    fn check(&self, endpoint: &str, fingerprint: &str) -> Result<bool> {
        let _lock = self.lock.lock().unwrap();
        match self.read()?.get(endpoint) {
            Some(known) if known == fingerprint => Ok(true),
            Some(_) => Err(AppError::ChangedHostKey(endpoint.into())),
            None => Ok(false),
        }
    }

    fn trust(&self, endpoint: String, fingerprint: String) -> Result<()> {
        let _lock = self.lock.lock().unwrap();
        let mut keys = self.read()?;
        match keys.get(&endpoint) {
            Some(known) if known == &fingerprint => return Ok(()),
            Some(_) => return Err(AppError::ChangedHostKey(endpoint)),
            None => {}
        }
        keys.insert(endpoint, fingerprint);
        super::write_json_atomically(&self.path, &keys)
    }
}

pub fn verify(session: &Session, profile: &SshProfile) -> Result<()> {
    let endpoint = endpoint(profile);
    let (fingerprint, _) = fingerprint(session)?;
    if store()?.check(&endpoint, &fingerprint)? {
        Ok(())
    } else {
        Err(AppError::UnknownHostKey(endpoint))
    }
}

pub fn inspect(profile: &SshProfile) -> Result<HostKeyInfo> {
    let session = handshake(connect_tcp(profile)?)?;
    let endpoint = endpoint(profile);
    let (fingerprint, algorithm) = fingerprint(&session)?;
    let trusted = store()?.check(&endpoint, &fingerprint)?;
    Ok(HostKeyInfo {
        endpoint,
        fingerprint,
        algorithm,
        trusted,
    })
}

pub fn trust(profile: &SshProfile, expected_fingerprint: &str) -> Result<()> {
    let session = handshake(connect_tcp(profile)?)?;
    let (actual, _) = fingerprint(&session)?;
    let endpoint = endpoint(profile);
    if actual != expected_fingerprint {
        return Err(AppError::ChangedHostKey(endpoint));
    }
    store()?.trust(endpoint, actual)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trust_is_scoped_to_the_endpoint_and_rejects_replacement() {
        let directory = tempfile::tempdir().unwrap();
        let store = HostKeys {
            path: directory.path().join("known_hosts.json"),
            lock: Mutex::new(()),
        };
        let endpoint = "[example.test]:22";
        assert!(!store.check(endpoint, "original").unwrap());
        store.trust(endpoint.into(), "original".into()).unwrap();
        assert!(store.check(endpoint, "original").unwrap());
        assert!(!store.check("[example.test]:2222", "original").unwrap());
        assert!(matches!(
            store.check(endpoint, "changed"),
            Err(AppError::ChangedHostKey(_))
        ));
        assert!(store.trust(endpoint.into(), "changed".into()).is_err());
        assert!(store.check(endpoint, "original").unwrap());
    }
}
