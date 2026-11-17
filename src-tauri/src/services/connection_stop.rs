use std::net::{Shutdown, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use crate::error::{AppError, Result};

#[derive(Default)]
pub struct ConnectionStop {
    cancelled: AtomicBool,
    stream: Mutex<Option<TcpStream>>,
}

impl ConnectionStop {
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Acquire)
    }

    pub fn attach(&self, stream: &TcpStream) -> Result<()> {
        let mut socket = self.stream.lock().unwrap();
        if self.is_cancelled() {
            return Err(AppError::Custom("Connection cancelled".into()));
        }
        *socket = Some(stream.try_clone()?);
        Ok(())
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Release);
        if let Some(stream) = self.stream.lock().unwrap().take() {
            let _ = stream.shutdown(Shutdown::Both);
        }
    }
}
