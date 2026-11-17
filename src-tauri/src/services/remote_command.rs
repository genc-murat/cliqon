use std::io::{ErrorKind, Read};
use std::time::{Duration, Instant};

use ssh2::Session;

use crate::error::{AppError, Result};

pub fn execute(session: &Session, command: &str) -> Result<String> {
    let mut channel = session.channel_session()?;
    channel.exec(command)?;
    channel.send_eof()?;

    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let mut output = channel.stream(0);
    let mut errors = channel.stderr();
    let mut open = [true, true];
    let mut buffer = [0u8; 8192];
    let mut last_output = Instant::now();
    session.set_blocking(false);
    let read_result = (|| -> Result<()> {
        while open.iter().any(|stream_open| *stream_open) {
            let mut received = false;
            for (index, (stream, destination)) in
                [(&mut output, &mut stdout), (&mut errors, &mut stderr)]
                    .into_iter()
                    .enumerate()
            {
                if !open[index] {
                    continue;
                }
                match stream.read(&mut buffer) {
                    Ok(0) => open[index] = false,
                    Ok(count) => {
                        destination.extend_from_slice(&buffer[..count]);
                        received = true;
                    }
                    Err(error) if error.kind() == ErrorKind::WouldBlock => {}
                    Err(error) => return Err(error.into()),
                }
            }
            if received {
                last_output = Instant::now();
            } else if last_output.elapsed() >= Duration::from_secs(60) {
                return Err(AppError::Custom(
                    "Timed out waiting for the remote command".into(),
                ));
            } else if open.iter().any(|stream_open| *stream_open) {
                std::thread::sleep(Duration::from_millis(10));
            }
        }
        Ok(())
    })();
    session.set_blocking(true);
    read_result?;
    channel.wait_close()?;

    let code = channel.exit_status()?;
    if code == 0 {
        return Ok(String::from_utf8_lossy(&stdout).into_owned());
    }
    let details = String::from_utf8_lossy(if stderr.is_empty() { &stdout } else { &stderr });
    let details: String = details.trim().chars().take(1000).collect();
    if details.is_empty() {
        Err(AppError::Custom(format!(
            "Remote command failed with exit code {code}"
        )))
    } else {
        Err(AppError::Custom(format!(
            "Remote command failed with exit code {code}: {details}"
        )))
    }
}
