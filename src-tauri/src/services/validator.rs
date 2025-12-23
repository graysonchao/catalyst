use serde_json::Value;

use crate::models::{EntityMeta, ValidationResult};

/// Validate JSON text and return a validation result
pub fn validate_json_text(text: &str) -> ValidationResult {
    match serde_json::from_str::<Value>(text) {
        Ok(value) => validate_entity_json(&value),
        Err(e) => {
            let mut result = ValidationResult::default();
            result.add_error(
                "INVALID_JSON",
                format!("Invalid JSON syntax: {}", e),
            );
            // Try to extract line number from error
            if let Some(line) = extract_line_from_error(&e.to_string()) {
                if let Some(error) = result.errors.first_mut() {
                    error.line = Some(line);
                }
            }
            result
        }
    }
}

/// Validate a parsed JSON value as an entity
pub fn validate_entity_json(value: &Value) -> ValidationResult {
    let mut result = ValidationResult::ok();

    // Must be an object
    if !value.is_object() {
        result.add_error("NOT_OBJECT", "Entity must be a JSON object");
        return result;
    }

    // Must have "type" field
    if value.get("type").is_none() {
        result.add_error_with_path("MISSING_TYPE", "Entity must have a 'type' field", "$");
    }

    let entity_type = value
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Check for ID field (with exceptions)
    let is_abstract = value.get("abstract").is_some();
    let is_recipe = entity_type == "recipe" || entity_type == "uncraft";

    if !is_abstract {
        let has_id = value.get("id").is_some();
        let has_result = value.get("result").is_some();

        if !(has_id || (is_recipe && has_result)) {
            result.add_error_with_path(
                "MISSING_ID",
                "Entity must have an 'id' field (or 'result' for recipes)",
                "$",
            );
        }
    }

    // Type-specific validation
    result.merge(validate_type_specific(value, entity_type));

    result
}

/// Type-specific validation rules
fn validate_type_specific(value: &Value, entity_type: &str) -> ValidationResult {
    let mut result = ValidationResult::ok();

    match entity_type {
        "recipe" | "uncraft" => {
            validate_recipe(value, &mut result);
        }
        "MONSTER" => {
            validate_monster(value, &mut result);
        }
        "vehicle" => {
            validate_vehicle(value, &mut result);
        }
        "mapgen" => {
            validate_mapgen(value, &mut result);
        }
        _ => {
            // Generic item types and others - no specific validation yet
        }
    }

    result
}

fn validate_recipe(value: &Value, result: &mut ValidationResult) {
    // Recipes should have category and subcategory
    if value.get("category").is_none() && value.get("copy-from").is_none() {
        result.add_warning(
            "MISSING_CATEGORY",
            "Recipe should have a 'category' field for menu organization",
        );
    }

    // Check for either components or using
    if value.get("components").is_none()
        && value.get("using").is_none()
        && value.get("copy-from").is_none()
    {
        result.add_warning(
            "NO_COMPONENTS",
            "Recipe has no 'components' or 'using' field",
        );
    }
}

fn validate_monster(value: &Value, result: &mut ValidationResult) {
    // Monsters should have basic stats unless copying
    if value.get("copy-from").is_none() {
        if value.get("hp").is_none() {
            result.add_warning("MISSING_HP", "Monster should have an 'hp' field");
        }
        if value.get("speed").is_none() {
            result.add_warning("MISSING_SPEED", "Monster should have a 'speed' field");
        }
    }
}

fn validate_vehicle(value: &Value, result: &mut ValidationResult) {
    // Vehicles should have parts
    if value.get("parts").is_none() && value.get("copy-from").is_none() {
        result.add_warning("MISSING_PARTS", "Vehicle should have a 'parts' array");
    }
}

fn validate_mapgen(value: &Value, result: &mut ValidationResult) {
    // Mapgen should have om_terrain and object with rows
    if value.get("om_terrain").is_none() {
        result.add_warning(
            "MISSING_OM_TERRAIN",
            "Mapgen should have an 'om_terrain' field",
        );
    }

    if let Some(obj) = value.get("object") {
        if obj.get("rows").is_none() && obj.get("fill_ter").is_none() {
            result.add_warning(
                "MISSING_ROWS",
                "Mapgen object should have 'rows' or 'fill_ter'",
            );
        }
    } else if value.get("copy-from").is_none() {
        result.add_warning("MISSING_OBJECT", "Mapgen should have an 'object' field");
    }
}

/// Try to extract line number from JSON parse error message
fn extract_line_from_error(error: &str) -> Option<usize> {
    // serde_json errors look like "... at line X column Y"
    if let Some(pos) = error.find("at line ") {
        let rest = &error[pos + 8..];
        if let Some(end) = rest.find(' ') {
            return rest[..end].parse().ok();
        }
    }
    None
}

/// Validate that an entity can be updated (check type/id changes)
#[allow(dead_code)]
pub fn validate_update(
    old_json: &Value,
    new_json: &Value,
) -> ValidationResult {
    let mut result = validate_entity_json(new_json);

    // Warn if type is being changed
    let old_type = old_json.get("type").and_then(|v| v.as_str());
    let new_type = new_json.get("type").and_then(|v| v.as_str());

    if old_type != new_type {
        result.add_warning(
            "TYPE_CHANGED",
            format!(
                "Entity type changed from {:?} to {:?}",
                old_type, new_type
            ),
        );
    }

    result
}

/// Extract EntityMeta from validated JSON (assumes already validated)
#[allow(dead_code)]
pub fn extract_meta(json: &Value) -> Option<EntityMeta> {
    EntityMeta::from_json(json)
}
