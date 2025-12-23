use serde::Serialize;

#[derive(Debug, Clone, Default, Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidationError {
    /// Error code (e.g., "INVALID_JSON", "MISSING_TYPE", "MISSING_ID")
    pub code: String,
    /// Human-readable message
    pub message: String,
    /// JSON path to the error (e.g., "$.components[0]")
    pub path: Option<String>,
    /// Line number if available
    pub line: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidationWarning {
    /// Warning code (e.g., "UNKNOWN_REFERENCE", "DEPRECATED_FIELD")
    pub code: String,
    /// Human-readable message
    pub message: String,
    /// JSON path to the issue
    pub path: Option<String>,
}

impl ValidationResult {
    pub fn ok() -> Self {
        Self {
            valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }

    #[allow(dead_code)]
    pub fn with_error(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            valid: false,
            errors: vec![ValidationError {
                code: code.into(),
                message: message.into(),
                path: None,
                line: None,
            }],
            warnings: Vec::new(),
        }
    }

    pub fn add_error(&mut self, code: impl Into<String>, message: impl Into<String>) {
        self.valid = false;
        self.errors.push(ValidationError {
            code: code.into(),
            message: message.into(),
            path: None,
            line: None,
        });
    }

    pub fn add_error_with_path(
        &mut self,
        code: impl Into<String>,
        message: impl Into<String>,
        path: impl Into<String>,
    ) {
        self.valid = false;
        self.errors.push(ValidationError {
            code: code.into(),
            message: message.into(),
            path: Some(path.into()),
            line: None,
        });
    }

    pub fn add_warning(&mut self, code: impl Into<String>, message: impl Into<String>) {
        self.warnings.push(ValidationWarning {
            code: code.into(),
            message: message.into(),
            path: None,
        });
    }

    pub fn merge(&mut self, other: ValidationResult) {
        if !other.valid {
            self.valid = false;
        }
        self.errors.extend(other.errors);
        self.warnings.extend(other.warnings);
    }
}

#[allow(dead_code)]
impl ValidationError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            path: None,
            line: None,
        }
    }

    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.path = Some(path.into());
        self
    }

    pub fn with_line(mut self, line: usize) -> Self {
        self.line = Some(line);
        self
    }
}
