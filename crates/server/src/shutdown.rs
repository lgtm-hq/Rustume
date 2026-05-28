use tokio::signal;
use tracing::info;

use crate::config::DEFAULT_PORT;

pub async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("Shutdown signal received, starting graceful shutdown");
}

/// Perform a health probe by sending an HTTP GET to the local `/health` endpoint.
///
/// Used with `--health` so the same binary serves as its own healthchecker
/// in distroless containers where curl/wget are unavailable.
pub fn health_probe() -> i32 {
    use std::io::{Read, Write};

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_PORT);

    let timeout = std::time::Duration::from_secs(3);
    let addr: std::net::SocketAddr = ([127, 0, 0, 1], port).into();

    let mut stream = match std::net::TcpStream::connect_timeout(&addr, timeout) {
        Ok(s) => s,
        Err(_) => return 1,
    };
    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));

    let request =
        format!("GET /health HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n");
    if stream.write_all(request.as_bytes()).is_err() {
        return 1;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return 1;
    }

    match response
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse::<u16>().ok())
    {
        Some(200..=299) => 0,
        _ => 1,
    }
}
