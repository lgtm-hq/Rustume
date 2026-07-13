//! Import/export parsers for Rustume.
//!
//! Supports parsing from:
//! - JSON Resume format
//! - LinkedIn data export (ZIP)
//! - Reactive Resume V3 format (migration)

mod dispatch;
mod json_resume;
mod linkedin;
mod reactive_resume_v3;
mod traits;

pub use dispatch::{parse_resume, ResumeFormat};
pub use json_resume::{JsonResume, JsonResumeParser};
pub use linkedin::{LinkedInData, LinkedInParser};
pub use reactive_resume_v3::{ReactiveResumeV3Parser, V3Resume};
pub use traits::*;
