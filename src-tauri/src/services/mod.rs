pub mod auth;
mod connection_stop;
pub mod docker;
pub mod host_keys;
pub mod import;
pub mod logging;
pub mod monitor;
pub mod net_tools;
mod remote_command;
pub mod sftp;
pub mod sharing;
pub mod snippet;
pub mod ssh;
pub mod store;
pub mod system;
pub mod tunnel;

use std::{io::Write, path::Path};

fn write_json_atomically(path: &Path, data: &impl serde::Serialize) -> crate::error::Result<()> {
    let directory = path.parent().expect("application data path has a parent");
    let mut temporary = tempfile::NamedTempFile::new_in(directory)?;
    serde_json::to_writer_pretty(&mut temporary, data)?;
    temporary.flush()?;
    temporary.as_file().sync_all()?;
    temporary.persist(path).map_err(|error| error.error)?;
    Ok(())
}
