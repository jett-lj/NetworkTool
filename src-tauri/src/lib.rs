use serde::Serialize;
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Serialize, Clone)]
pub struct PortEntry {
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
    pub address: String,
}

fn parse_netstat_output(output: &str) -> Vec<(String, u16, u32)> {
    let mut entries = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if !line.contains("LISTENING") {
            continue;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        // Expected format: TCP  <local_addr>:<port>  <foreign_addr>  LISTENING  <pid>
        if parts.len() < 5 {
            continue;
        }
        if parts[0] != "TCP" {
            continue;
        }
        let local_addr = parts[1];
        let pid_str = parts[4];

        let pid: u32 = match pid_str.parse() {
            Ok(p) => p,
            Err(_) => continue,
        };

        // Parse address:port — handle IPv6 like [::]:port
        let (addr, port) = if local_addr.starts_with('[') {
            // IPv6: [::]:port or [::1]:port
            match local_addr.rfind("]:") {
                Some(pos) => {
                    let addr_part = &local_addr[..pos + 1]; // includes ]
                    let port_str = &local_addr[pos + 2..];
                    match port_str.parse::<u16>() {
                        Ok(p) => (addr_part.to_string(), p),
                        Err(_) => continue,
                    }
                }
                None => continue,
            }
        } else {
            // IPv4: 0.0.0.0:port or 127.0.0.1:port
            match local_addr.rfind(':') {
                Some(pos) => {
                    let addr_part = &local_addr[..pos];
                    let port_str = &local_addr[pos + 1..];
                    match port_str.parse::<u16>() {
                        Ok(p) => (addr_part.to_string(), p),
                        Err(_) => continue,
                    }
                }
                None => continue,
            }
        };

        entries.push((addr, port, pid));
    }
    entries
}

fn get_process_names() -> HashMap<u32, String> {
    let mut map = HashMap::new();
    let output = Command::new("tasklist")
        .args(["/FO", "CSV", "/NH"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            // Format: "process.exe","PID","Session Name","Session#","Mem Usage"
            let fields: Vec<&str> = line.split(',').collect();
            if fields.len() >= 2 {
                let name = fields[0].trim_matches('"').to_string();
                let pid_str = fields[1].trim_matches('"');
                if let Ok(pid) = pid_str.parse::<u32>() {
                    map.insert(pid, name);
                }
            }
        }
    }
    map
}

#[tauri::command]
fn scan_ports() -> Vec<PortEntry> {
    let output = Command::new("netstat")
        .args(["-ano"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    let output = match output {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let raw_entries = parse_netstat_output(&stdout);
    let process_names = get_process_names();

    // Deduplicate by port (keep first occurrence)
    let mut seen_ports = HashMap::new();
    let mut entries = Vec::new();

    for (addr, port, pid) in raw_entries {
        if seen_ports.contains_key(&port) {
            continue;
        }
        seen_ports.insert(port, true);

        let process_name = process_names
            .get(&pid)
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());

        entries.push(PortEntry {
            port,
            pid,
            process_name,
            address: addr,
        });
    }

    // Sort by port number
    entries.sort_by_key(|e| e.port);
    entries
}

#[tauri::command]
fn kill_process(pid: u32) -> Result<String, String> {
    if pid == 0 || pid == 4 {
        return Err("Cannot kill system process".to_string());
    }

    let output = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to execute taskkill: {}", e))?;

    if output.status.success() {
        Ok(format!("Process {} terminated", pid))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to kill process {}: {}", pid, stderr.trim()))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![scan_ports, kill_process])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
