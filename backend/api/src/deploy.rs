//! Static-site deploy adapters: Cloudflare Pages, Vercel, GitHub Pages.
//!
//! These were Node server functions that only existed to reach the provider API
//! from the page's origin. The provider token arrives with each request — it is
//! a Connections setting and is never stored here.

use base64::Engine as _;
use regex::Regex;
use serde::Deserialize;
use serde_json::{json, Value};

const CLOUDFLARE: &str = "https://api.cloudflare.com";
const VERCEL: &str = "https://api.vercel.com";
const GITHUB: &str = "https://api.github.com";

/// 48 MB of base64 is the 32 MiB payload the adapters accept.
const MAX_TOTAL_BASE64: usize = 48_000_000;

fn failure(error: impl Into<String>) -> Value {
    json!({ "ok": false, "error": error.into() })
}

fn safe_message(text: &str) -> String {
    // A provider error body can echo the Authorization header.
    let redacted = Regex::new(r"(?i)(authorization|bearer|token)\s*[:=]?\s*\S+")
        .map(|re| re.replace_all(text, "$1 •••").to_string())
        .unwrap_or_else(|_| text.to_string());
    redacted.chars().take(320).collect()
}

#[derive(Debug, Deserialize)]
pub struct DeployFile {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub base64: String,
}

#[derive(Debug, Default)]
pub struct DeployFiles {
    pub files: Vec<DeployFile>,
    pub error: Option<String>,
}

/// Shared payload validation for every adapter.
///
/// A file name reaches a provider path, so `..` and anything outside the
/// printable-safe set is refused before a single byte is uploaded.
pub fn read_deploy_files(raw: &[DeployFile]) -> DeployFiles {
    if raw.is_empty() {
        return DeployFiles {
            files: Vec::new(),
            error: Some("No files to deploy.".into()),
        };
    }
    if raw.len() > 400 {
        return DeployFiles {
            files: Vec::new(),
            error: Some("Refusing more than 400 files in one adapter deploy.".into()),
        };
    }
    let allowed = Regex::new(r"^[A-Za-z0-9._/-]+$").expect("static regex");
    let b64 = Regex::new(r"^[A-Za-z0-9+/=]+$").expect("static regex");
    let mut total = 0usize;
    let mut files = Vec::new();
    for entry in raw {
        let name = entry.name.replace('\\', "/");
        let name = name.trim_start_matches('/').to_string();
        if name.is_empty() || name.contains("..") || !allowed.is_match(&name) {
            return DeployFiles {
                files: Vec::new(),
                error: Some(format!(
                    "Unsafe file name in the deploy payload: {}",
                    if name.is_empty() { "(empty)" } else { &name }
                )),
            };
        }
        if !b64.is_match(&entry.base64) {
            return DeployFiles {
                files: Vec::new(),
                error: Some(format!("File {name} is not valid base64.")),
            };
        }
        total += entry.base64.len();
        if total > MAX_TOTAL_BASE64 {
            return DeployFiles {
                files: Vec::new(),
                error: Some("Deploy payload exceeds the 32 MiB limit.".into()),
            };
        }
        files.push(DeployFile {
            name,
            base64: entry.base64.clone(),
        });
    }
    DeployFiles { files, error: None }
}

#[derive(Debug, Deserialize)]
pub struct CloudflareRequest {
    #[serde(default)]
    pub account_id: String,
    #[serde(default)]
    pub token: String,
    #[serde(default)]
    pub project_name: String,
    #[serde(default)]
    pub files: Vec<DeployFile>,
}

pub async fn deploy_cloudflare(req: &CloudflareRequest) -> Value {
    let token = req.token.trim();
    if token.is_empty() {
        return failure("A Cloudflare API token is required. Save it on Connections first.");
    }
    let project: String = req
        .project_name
        .trim()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(64)
        .collect();
    let account = req.account_id.trim();
    if account.is_empty() || project.is_empty() {
        return failure("Cloudflare needs the account id and the Pages project name.");
    }
    let checked = read_deploy_files(&req.files);
    if let Some(error) = checked.error {
        return failure(error);
    }

    // Pages takes the files as form fields plus a manifest that names each one.
    let mut manifest = serde_json::Map::new();
    let mut form = reqwest::multipart::Form::new();
    for file in &checked.files {
        let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(&file.base64) else {
            return failure(format!("File {} is not valid base64.", file.name));
        };
        manifest.insert(format!("/{}", file.name), json!(file.name));
        let part = match reqwest::multipart::Part::bytes(bytes)
            .file_name(file.name.clone())
            .mime_str("application/octet-stream")
        {
            Ok(part) => part,
            Err(error) => return failure(safe_message(&error.to_string())),
        };
        form = form.part(file.name.clone(), part);
    }
    form = form
        .text("manifest", Value::Object(manifest).to_string())
        .text("branch", "production");

    let url = format!(
        "{CLOUDFLARE}/client/v4/accounts/{account}/pages/projects/{project}/deployments"
    );
    let response = reqwest::Client::new()
        .post(url)
        .header("Authorization", format!("Bearer {token}"))
        .multipart(form)
        .send()
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => return failure(safe_message(&error.to_string())),
    };
    if matches!(response.status().as_u16(), 401 | 403) {
        return failure("Cloudflare refused the API token (check Pages:Edit scope).");
    }
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let text = response.text().await.unwrap_or_default();
        return failure(format!(
            "Cloudflare returned HTTP {status}: {}",
            safe_message(text.chars().take(200).collect::<String>().as_str())
        ));
    }
    let body: Value = response.json().await.unwrap_or(Value::Null);
    let id = body
        .get("result")
        .and_then(|r| r.get("id"))
        .and_then(|v| v.as_str())
        .unwrap_or("created");
    json!({
        "ok": true,
        "detail": format!("Cloudflare Pages deployment {id}."),
        "url": body.get("result").and_then(|r| r.get("url")).cloned().unwrap_or(Value::Null),
        "files": checked.files.len(),
    })
}

#[derive(Debug, Deserialize)]
pub struct VercelRequest {
    #[serde(default)]
    pub token: String,
    #[serde(default)]
    pub project_name: String,
    #[serde(default)]
    pub files: Vec<DeployFile>,
}

pub async fn deploy_vercel(req: &VercelRequest) -> Value {
    let token = req.token.trim();
    if token.is_empty() {
        return failure("A Vercel token is required. Save it on Connections first.");
    }
    let project: String = req
        .project_name
        .trim()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(64)
        .collect();
    if project.is_empty() {
        return failure("Vercel needs the project name.");
    }
    let checked = read_deploy_files(&req.files);
    if let Some(error) = checked.error {
        return failure(error);
    }
    let files: Vec<Value> = checked
        .files
        .iter()
        .take(100)
        .map(|file| json!({ "file": file.name, "data": file.base64, "encoding": "base64" }))
        .collect();
    let body = json!({
        "name": project,
        "target": "production",
        "files": files,
        "projectSettings": {
            "framework": Value::Null,
            "buildCommand": Value::Null,
            "outputDirectory": Value::Null,
            "installCommand": Value::Null,
        },
    });
    let response = reqwest::Client::new()
        .post(format!("{VERCEL}/v13/deployments"))
        .header("Authorization", format!("Bearer {token}"))
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => return failure(safe_message(&error.to_string())),
    };
    if matches!(response.status().as_u16(), 401 | 403) {
        return failure("Vercel refused the token.");
    }
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let text = response.text().await.unwrap_or_default();
        return failure(format!(
            "Vercel returned HTTP {status}: {}",
            safe_message(text.chars().take(200).collect::<String>().as_str())
        ));
    }
    let body: Value = response.json().await.unwrap_or(Value::Null);
    let id = body.get("id").and_then(|v| v.as_str()).unwrap_or("created");
    let url = body
        .get("url")
        .and_then(|v| v.as_str())
        .map(|u| format!("https://{u}"));
    json!({
        "ok": true,
        "detail": format!("Vercel deployment {id}."),
        "url": url,
        "files": checked.files.len(),
    })
}

#[derive(Debug, Deserialize)]
pub struct GithubRequest {
    #[serde(default)]
    pub token: String,
    #[serde(default)]
    pub repo: String,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub files: Vec<DeployFile>,
}

pub async fn deploy_github(req: &GithubRequest) -> Value {
    let token = req.token.trim();
    if token.is_empty() {
        return failure("A GitHub token is required. Save it on Connections first.");
    }
    let repo = req.repo.trim();
    let repo_ok = Regex::new(r"^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$").expect("static regex");
    if !repo_ok.is_match(repo) {
        return failure("GitHub needs the repo as owner/name.");
    }
    let branch: String = req
        .branch
        .as_deref()
        .unwrap_or("gh-pages")
        .trim()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '/' | '-'))
        .take(64)
        .collect();
    let branch = if branch.is_empty() {
        "gh-pages".to_string()
    } else {
        branch
    };
    let checked = read_deploy_files(&req.files);
    if let Some(error) = checked.error {
        return failure(error);
    }

    let client = reqwest::Client::new();
    let mut written = 0usize;
    for file in checked.files.iter().take(120) {
        // Existing files need their sha for an update; a 404 means a fresh create.
        let head = client
            .get(format!(
                "{GITHUB}/repos/{repo}/contents/{}?ref={branch}",
                file.name
            ))
            .header("Authorization", format!("Bearer {token}"))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "ghost-grok-static")
            .send()
            .await;
        let sha = match head {
            Err(error) => return failure(safe_message(&error.to_string())),
            Ok(response) if response.status().is_success() => response
                .json::<Value>()
                .await
                .ok()
                .and_then(|body| body.get("sha").and_then(|s| s.as_str()).map(str::to_string)),
            Ok(_) => None,
        };
        let mut body = serde_json::Map::new();
        body.insert("message".into(), json!(format!("Deploy {}", file.name)));
        body.insert("content".into(), json!(file.base64));
        body.insert("branch".into(), json!(branch));
        if let Some(sha) = sha {
            body.insert("sha".into(), json!(sha));
        }
        let put = client
            .put(format!("{GITHUB}/repos/{repo}/contents/{}", file.name))
            .header("Authorization", format!("Bearer {token}"))
            .header("Accept", "application/vnd.github+json")
            .header("Content-Type", "application/json")
            .header("User-Agent", "ghost-grok-static")
            .body(Value::Object(body).to_string())
            .send()
            .await;
        let put = match put {
            Ok(response) => response,
            Err(error) => return failure(safe_message(&error.to_string())),
        };
        if matches!(put.status().as_u16(), 401 | 403) {
            return failure("GitHub refused the token (needs contents:write on that repo).");
        }
        if !put.status().is_success() {
            let status = put.status().as_u16();
            return failure(format!(
                "GitHub returned HTTP {status} while writing {}.",
                file.name
            ));
        }
        written += 1;
    }
    json!({
        "ok": true,
        "detail": format!("Pushed {written} files to {repo}@{branch}. GitHub Pages serves the branch after its own build."),
        "files": written,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(name: &str, base64: &str) -> DeployFile {
        DeployFile {
            name: name.to_string(),
            base64: base64.to_string(),
        }
    }

    #[test]
    fn a_traversing_or_odd_filename_is_refused() {
        for name in ["../etc/passwd", "a/../../b", "", "weird name.html", "quote\"s"] {
            assert!(
                read_deploy_files(&[file(name, "aGk=")]).error.is_some(),
                "accepted {name:?}"
            );
        }
        // A leading slash is normalised away rather than refused.
        let checked = read_deploy_files(&[file("/index.html", "aGk=")]);
        assert!(checked.error.is_none());
        assert_eq!(checked.files[0].name, "index.html");
        // Backslashes are normalised to forward slashes.
        let checked = read_deploy_files(&[file("css\\site.css", "aGk=")]);
        assert_eq!(checked.files[0].name, "css/site.css");
    }

    #[test]
    fn a_payload_that_is_not_base64_is_refused() {
        assert!(read_deploy_files(&[file("index.html", "not base64!")])
            .error
            .is_some());
        assert!(read_deploy_files(&[]).error.is_some());
    }

    #[test]
    fn the_file_cap_is_enforced() {
        let many: Vec<DeployFile> = (0..401).map(|i| file(&format!("f{i}.html"), "aGk=")).collect();
        assert_eq!(
            read_deploy_files(&many).error.as_deref(),
            Some("Refusing more than 400 files in one adapter deploy.")
        );
    }
}
