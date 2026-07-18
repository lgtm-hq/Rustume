//! HTTP route handlers for the Rustume API.

pub mod account;
pub mod auth;
pub mod export;
pub mod health;
pub mod metrics;
pub mod parse;
pub mod render;
pub mod resumes;
pub mod security_txt;
pub mod static_files;
pub mod templates;
pub mod validate;

pub use account::{delete_account, export_account};
pub use auth::{callback, login, logout, me};
pub use export::{export_resumes_json, export_resumes_pdf};
pub use health::health;
pub use metrics::{init_metrics, metrics};
pub use parse::parse;
pub use render::{render_pdf, render_preview};
pub use resumes::{
    create_resume, delete_resume, get_resume, import_resumes, list_resumes, update_resume,
};
pub use security_txt::security_txt;
pub use static_files::{sanitize_static_path, spa_fallback, static_dir};
pub use templates::{list_templates, template_thumbnail};
pub use validate::validate;
