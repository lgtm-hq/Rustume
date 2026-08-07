//! Render a resume JSON export to PDF from the command line.
//!
//! Useful for eyeballing template changes against a real export without
//! booting the server:
//!
//! ```sh
//! cargo run -p rustume-render --example render_json -- resume.json out.pdf
//! ```
//!
//! The input is parsed as native `ResumeData` first, then as a
//! Reactive-Resume v3 export. When the second argument is `--text`, the
//! extracted PDF text is printed per page instead of writing a file.

use rustume_parser::{Parser, ReactiveResumeV3Parser};
use rustume_render::{Renderer, TypstRenderer};
use rustume_schema::ResumeData;

fn main() {
    let mut args = std::env::args().skip(1);
    let input = args
        .next()
        .expect("usage: render_json <resume.json> <out.pdf|--text>");
    let output = args
        .next()
        .expect("usage: render_json <resume.json> <out.pdf|--text>");

    let data = std::fs::read(&input).expect("failed to read input JSON");
    let resume: ResumeData = match serde_json::from_slice(&data) {
        Ok(resume) => resume,
        Err(native_err) => ReactiveResumeV3Parser
            .parse(&data)
            .unwrap_or_else(|v3_err| {
                panic!("input parses neither as ResumeData ({native_err}) nor as v3 ({v3_err})")
            }),
    };

    let pdf = TypstRenderer::new()
        .render_pdf(&resume)
        .expect("render failed");

    if output == "--text" {
        let pages =
            pdf_extract::extract_text_from_mem_by_pages(&pdf).expect("text extraction failed");
        for (index, text) in pages.iter().enumerate() {
            println!("===== page {} =====\n{text}", index + 1);
        }
    } else {
        std::fs::write(&output, &pdf).expect("failed to write PDF");
        eprintln!("wrote {} bytes to {output}", pdf.len());
    }
}
