//! Procedural macros for Rustume schema types.
//!
//! This crate provides the `SectionItem` derive macro that reduces boilerplate
//! for resume section item types.
//!
//! # Example
//!
//! ```ignore
//! use rustume_schema_macros::SectionItem;
//!
//! #[derive(SectionItem, Debug, Clone)]
//! #[section_item(new(company, position))]
//! pub struct Experience {
//!     pub company: String,
//!     pub position: String,
//!     #[serde(default)]
//!     pub location: String,
//! }
//! ```
//!
//! This generates:
//! - `id: String` and `visible: bool` fields (injected)
//! - `Default` impl with `id: String::new()`, `visible: true`
//! - `new(company, position)` constructor with auto-generated ID
//! - `with_location()` builder for optional fields

use proc_macro::TokenStream;
use quote::{format_ident, quote};
use syn::{
    parse::{Parse, ParseStream},
    parse_macro_input,
    punctuated::Punctuated,
    Attribute, DeriveInput, Field, Fields, Ident, Result, Token,
};

/// Arguments for the section_item attribute.
struct SectionItemArgs {
    /// Fields required in the `new()` constructor.
    new_args: Vec<Ident>,
}

impl Parse for SectionItemArgs {
    fn parse(input: ParseStream) -> Result<Self> {
        let mut new_args = Vec::new();

        while !input.is_empty() {
            let ident: Ident = input.parse()?;
            if ident == "new" {
                // Parse: new(field1, field2, ...)
                let content;
                syn::parenthesized!(content in input);
                let args: Punctuated<Ident, Token![,]> =
                    content.parse_terminated(Ident::parse, Token![,])?;
                new_args = args.into_iter().collect();
            }

            // Handle trailing comma
            if input.peek(Token![,]) {
                let _: Token![,] = input.parse()?;
            }
        }

        Ok(SectionItemArgs { new_args })
    }
}

/// Find the section_item attribute and parse its arguments.
fn parse_section_item_attr(attrs: &[Attribute]) -> Option<SectionItemArgs> {
    for attr in attrs {
        if attr.path().is_ident("section_item") {
            return attr.parse_args::<SectionItemArgs>().ok();
        }
    }
    None
}

/// Check if a field has `#[serde(default)]` or `#[serde(default = "...")]`.
fn has_serde_default(field: &Field) -> bool {
    for attr in &field.attrs {
        if attr.path().is_ident("serde") {
            // Parse the attribute as a list: #[serde(...)]
            if let syn::Meta::List(meta_list) = &attr.meta {
                // Parse the nested tokens
                let nested =
                    meta_list.parse_args_with(Punctuated::<syn::Meta, Token![,]>::parse_terminated);
                if let Ok(nested) = nested {
                    for meta in nested {
                        match &meta {
                            // #[serde(default)]
                            syn::Meta::Path(path) if path.is_ident("default") => return true,
                            // #[serde(default = "...")]
                            syn::Meta::NameValue(nv) if nv.path.is_ident("default") => return true,
                            _ => {}
                        }
                    }
                }
            }
        }
    }
    false
}

/// Check if a field type is `Url` (our custom Url type).
fn is_url_type(field: &Field) -> bool {
    if let syn::Type::Path(type_path) = &field.ty {
        if let Some(segment) = type_path.path.segments.last() {
            return segment.ident == "Url";
        }
    }
    false
}

/// Check if a field type is `Vec<...>`.
fn is_vec_type(field: &Field) -> bool {
    if let syn::Type::Path(type_path) = &field.ty {
        if let Some(segment) = type_path.path.segments.last() {
            return segment.ident == "Vec";
        }
    }
    false
}

/// Derive macro for section item types.
///
/// Generates `Default`, `new()` constructor, and `with_*` builder methods.
#[proc_macro_derive(SectionItem, attributes(section_item))]
pub fn derive_section_item(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;

    // Parse section_item attribute
    let args = parse_section_item_attr(&input.attrs).unwrap_or(SectionItemArgs {
        new_args: Vec::new(),
    });

    // Get struct fields
    let fields = match &input.data {
        syn::Data::Struct(data) => match &data.fields {
            Fields::Named(fields) => &fields.named,
            _ => panic!("SectionItem only supports structs with named fields"),
        },
        _ => panic!("SectionItem only supports structs"),
    };

    // Collect field names (excluding id and visible which we manage)
    let user_fields: Vec<_> = fields
        .iter()
        .filter(|f| {
            let name = f.ident.as_ref().unwrap().to_string();
            name != "id" && name != "visible"
        })
        .collect();

    // Generate Default impl
    let default_fields = fields.iter().map(|f| {
        let field_name = f.ident.as_ref().unwrap();
        let field_name_str = field_name.to_string();

        match field_name_str.as_str() {
            "id" => quote! { id: String::new() },
            "visible" => quote! { visible: true },
            _ => {
                let ty = &f.ty;
                // Check field type for appropriate default
                if is_vec_type(f) {
                    quote! { #field_name: Vec::new() }
                } else if is_url_type(f) {
                    quote! { #field_name: Url::default() }
                } else {
                    quote! { #field_name: <#ty>::default() }
                }
            }
        }
    });

    let default_impl = quote! {
        impl Default for #name {
            fn default() -> Self {
                Self {
                    #(#default_fields),*
                }
            }
        }
    };

    // Generate new() constructor
    let new_params: Vec<_> = args
        .new_args
        .iter()
        .map(|arg| {
            // Find the field type
            let field = fields
                .iter()
                .find(|f| f.ident.as_ref().unwrap() == arg)
                .unwrap_or_else(|| panic!("Field '{}' not found in struct", arg));
            let ty = &field.ty;
            quote! { #arg: impl Into<#ty> }
        })
        .collect();

    let new_field_inits = fields.iter().map(|f| {
        let field_name = f.ident.as_ref().unwrap();
        let field_name_str = field_name.to_string();

        if field_name_str == "id" {
            quote! { id: cuid2::create_id() }
        } else if field_name_str == "visible" {
            quote! { visible: true }
        } else if args.new_args.iter().any(|a| a == field_name) {
            quote! { #field_name: #field_name.into() }
        } else {
            quote! { #field_name: Default::default() }
        }
    });

    let new_impl = if args.new_args.is_empty() {
        // No-arg constructor
        quote! {
            /// Create a new item with a generated ID.
            pub fn new() -> Self {
                Self {
                    id: cuid2::create_id(),
                    visible: true,
                    ..Default::default()
                }
            }
        }
    } else {
        quote! {
            /// Create a new item with the required fields.
            pub fn new(#(#new_params),*) -> Self {
                Self {
                    #(#new_field_inits),*
                }
            }
        }
    };

    // Generate with_* builder methods for non-required fields
    let required_fields: std::collections::HashSet<_> = args
        .new_args
        .iter()
        .map(|i| i.to_string())
        .chain(["id".to_string(), "visible".to_string()])
        .collect();

    let builder_methods: Vec<_> = user_fields
        .iter()
        .filter(|f| {
            let name = f.ident.as_ref().unwrap().to_string();
            !required_fields.contains(&name) && has_serde_default(f)
        })
        .map(|f| {
            let field_name = f.ident.as_ref().unwrap();
            let method_name = format_ident!("with_{}", field_name);
            let ty = &f.ty;

            // Handle different types
            if is_url_type(f) {
                quote! {
                    /// Builder method to set the URL.
                    pub fn #method_name(mut self, url: impl Into<String>) -> Self {
                        self.#field_name = Url::new(url);
                        self
                    }
                }
            } else if is_vec_type(f) {
                quote! {
                    /// Builder method to set this field.
                    pub fn #method_name(mut self, #field_name: #ty) -> Self {
                        self.#field_name = #field_name;
                        self
                    }
                }
            } else {
                quote! {
                    /// Builder method to set this field.
                    pub fn #method_name(mut self, #field_name: impl Into<#ty>) -> Self {
                        self.#field_name = #field_name.into();
                        self
                    }
                }
            }
        })
        .collect();

    let impl_block = quote! {
        impl #name {
            #new_impl

            #(#builder_methods)*
        }
    };

    let expanded = quote! {
        #default_impl
        #impl_block
    };

    TokenStream::from(expanded)
}

/// Helper macro attribute for documentation (no-op, parsed by SectionItem).
#[proc_macro_attribute]
pub fn section_item(_attr: TokenStream, item: TokenStream) -> TokenStream {
    // This attribute is parsed by SectionItem derive, just pass through
    item
}
