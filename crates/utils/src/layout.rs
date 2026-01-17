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
pub fn remove_item_in_layout(
    item: &str,
    layout: &mut Vec<Vec<Vec<String>>>,
) -> Option<LayoutLocator> {
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
        None => return layout.to_vec(),
    };

    new_layout[current.page][current.column].remove(current.section);

    while new_layout.len() <= target.page {
        new_layout.push(Vec::new());
    }
    while new_layout[target.page].len() <= target.column {
        new_layout[target.page].push(Vec::new());
    }

    let insert_idx = target.section.min(new_layout[target.page][target.column].len());
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
}
