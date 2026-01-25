//! Layout manipulation utilities.

/// Position in the 3D layout array.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LayoutLocator {
    pub page: usize,
    pub column: usize,
    pub section: usize,
}

/// Find an item in the layout and return its position.
pub fn find_item_in_layout(item: &str, layout: &[Vec<Vec<String>>]) -> Option<LayoutLocator> {
    for (page_idx, page) in layout.iter().enumerate() {
        for (col_idx, column) in page.iter().enumerate() {
            for (sec_idx, section) in column.iter().enumerate() {
                if section == item {
                    return Some(LayoutLocator {
                        page: page_idx,
                        column: col_idx,
                        section: sec_idx,
                    });
                }
            }
        }
    }
    None
}

/// Remove an item from the layout, returning its previous position.
pub fn remove_item_in_layout(item: &str, layout: &mut [Vec<Vec<String>>]) -> Option<LayoutLocator> {
    if let Some(loc) = find_item_in_layout(item, layout) {
        layout[loc.page][loc.column].remove(loc.section);
        Some(loc)
    } else {
        None
    }
}

/// Move an item from one position to another.
pub fn move_item_in_layout(
    current: LayoutLocator,
    target: LayoutLocator,
    layout: &[Vec<Vec<String>>],
) -> Vec<Vec<Vec<String>>> {
    let mut new_layout = layout.to_vec();

    let item = match new_layout
        .get(current.page)
        .and_then(|p| p.get(current.column))
        .and_then(|c| c.get(current.section))
    {
        Some(item) => item.clone(),
        None => return new_layout,
    };

    new_layout[current.page][current.column].remove(current.section);

    while new_layout.len() <= target.page {
        new_layout.push(Vec::new());
    }
    while new_layout[target.page].len() <= target.column {
        new_layout[target.page].push(Vec::new());
    }

    // Adjust target section index if moving within same page/column and
    // the current position was before the target position
    let adjusted_target_section = if current.page == target.page
        && current.column == target.column
        && current.section < target.section
    {
        target.section.saturating_sub(1)
    } else {
        target.section
    };

    let insert_idx = adjusted_target_section.min(new_layout[target.page][target.column].len());
    new_layout[target.page][target.column].insert(insert_idx, item);

    new_layout
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_item_in_layout() {
        let layout = vec![vec![
            vec!["summary".to_string(), "experience".to_string()],
            vec!["skills".to_string()],
        ]];

        let loc = find_item_in_layout("experience", &layout);
        assert_eq!(
            loc,
            Some(LayoutLocator {
                page: 0,
                column: 0,
                section: 1
            })
        );

        assert_eq!(find_item_in_layout("nonexistent", &layout), None);
    }

    #[test]
    fn test_remove_item_in_layout() {
        let mut layout = vec![vec![
            vec!["summary".to_string(), "experience".to_string()],
            vec!["skills".to_string()],
        ]];

        let loc = remove_item_in_layout("experience", &mut layout);
        assert_eq!(
            loc,
            Some(LayoutLocator {
                page: 0,
                column: 0,
                section: 1
            })
        );
        assert_eq!(layout[0][0], vec!["summary".to_string()]);

        // Removing non-existent item returns None
        assert_eq!(remove_item_in_layout("nonexistent", &mut layout), None);
    }

    #[test]
    fn test_move_item_in_layout() {
        let layout = vec![vec![
            vec![
                "summary".to_string(),
                "experience".to_string(),
                "education".to_string(),
            ],
            vec!["skills".to_string()],
        ]];

        // Move experience to second column
        let current = LayoutLocator {
            page: 0,
            column: 0,
            section: 1,
        };
        let target = LayoutLocator {
            page: 0,
            column: 1,
            section: 0,
        };
        let new_layout = move_item_in_layout(current, target, &layout);

        assert_eq!(
            new_layout[0][0],
            vec!["summary".to_string(), "education".to_string()]
        );
        assert_eq!(
            new_layout[0][1],
            vec!["experience".to_string(), "skills".to_string()]
        );
    }

    #[test]
    fn test_move_item_within_same_column() {
        let layout = vec![vec![vec![
            "a".to_string(),
            "b".to_string(),
            "c".to_string(),
        ]]];

        // Move "a" to index 2; after removal adjustment it lands at index 1 (between "b" and "c")
        let current = LayoutLocator {
            page: 0,
            column: 0,
            section: 0,
        };
        let target = LayoutLocator {
            page: 0,
            column: 0,
            section: 2,
        };
        let new_layout = move_item_in_layout(current, target, &layout);

        assert_eq!(
            new_layout[0][0],
            vec!["b".to_string(), "a".to_string(), "c".to_string()]
        );
    }

    #[test]
    fn test_move_item_to_new_page() {
        let layout = vec![vec![vec!["summary".to_string()]]];

        let current = LayoutLocator {
            page: 0,
            column: 0,
            section: 0,
        };
        let target = LayoutLocator {
            page: 1,
            column: 0,
            section: 0,
        };
        let new_layout = move_item_in_layout(current, target, &layout);

        assert_eq!(new_layout.len(), 2);
        assert!(new_layout[0][0].is_empty());
        assert_eq!(new_layout[1][0], vec!["summary".to_string()]);
    }
}
