# Catalyst

A desktop editor for [Cataclysm: Bright Nights](https://github.com/cataclysmbnteam/Cataclysm-BN) mod JSON files.

99% vibe coded...

## Features

- **Entity Browser**: Browse and search all entities across loaded content packs with filtering by type and pack
- **JSON Editor**: Edit entity JSON with syntax highlighting and validation
- **Map Editor**: Visual editor for mapgen definitions with tileset support
  - Paint, line, box, and fill tools
  - Eyedropper for picking symbols
  - Smooth zoom and pan
  - Editable palette with terrain/furniture dropdowns
- **Pack Management**: Load multiple content packs with dependency tracking
- **Mod Directory Support**: Configure custom mod directories for your projects

## Installation

Download the latest release for your platform from the [Releases](https://github.com/cataclysmbnteam/Catalyst/releases) page:

- **macOS**: `Catalyst_x.x.x_universal.dmg` (Intel + Apple Silicon)
- **Windows**: `Catalyst_x.x.x_x64-setup.exe` or `.msi`
- **Linux**: `Catalyst_x.x.x_amd64.deb` or `.AppImage`

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20.19+ or 22.12+
- [Rust](https://rustup.rs/) (latest stable)
- Platform-specific dependencies:

**macOS:**
```bash
xcode-select --install
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev
```

**Windows:**
- [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 10/11)

### Running in Development

```bash
# Install dependencies
npm install

# Start development server
npm run tauri dev
```

### Building for Production

```bash
# Build release binary
npm run tauri build
```

Output will be in `src-tauri/target/release/bundle/`.

## Usage

1. **Set Game Directory**: Go to Settings and select your Cataclysm-BN installation directory
2. **Load Content Packs**: The base game data loads automatically; add mod directories for your mods
3. **Browse Entities**: Use the Entity Browser tab to explore all game content
4. **Edit Maps**: Use the Map Editor tab to visually edit mapgen definitions

### Map Editor Controls

| Key | Action |
|-----|--------|
| `A` | Hand tool (pan) |
| `Q` | Paint tool |
| `W` | Line tool |
| `E` | Box tool (press again to toggle filled/outline) |
| `R` | Fill tool |
| `S` | Eyedropper |
| `1-4` | Set zoom level |
| `Scroll` | Smooth zoom |
| `Alt+Click` | Quick eyedropper |
| `Middle drag` | Pan |

## Project Structure

```
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # React hooks
│   ├── services/           # API and data services
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri commands
│   │   ├── models/         # Data models
│   │   └── services/       # Business logic
│   └── Cargo.toml
└── package.json
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License

## Acknowledgments

- Built with [Tauri](https://tauri.app/), [React](https://react.dev/), and [TypeScript](https://www.typescriptlang.org/)
- For use with [Cataclysm: Bright Nights](https://github.com/cataclysmbnteam/Cataclysm-BN)
