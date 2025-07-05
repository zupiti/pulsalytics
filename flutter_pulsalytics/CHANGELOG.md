# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-06-07
### Added
- First public release of the plugin.
- Mouse, click, and screenshot tracking.
- Data sending to server via HTTP and WebSocket.
- Real-time visualization via admin-ui.
- Usage example and initial documentation.

### Notices
- Project under development. Sensitive data handling and code optimization are missing.

## [1.0.1] - 2025-01-07

### ✨ Added
- **Real-time mouse tracking**: Automatic capture of mouse movements
- **Click detection**: Precise click logging with position and timestamp
- **Automatic screenshot system**: Periodic screenshots with heatmaps
- **Smart fast capture**: Frequent screenshots when mouse is active
- **Session management**: Complete user session system
- **URL change detection**: Automatic SPA navigation tracking
- **Local storage**: Data persistence in browser localStorage
- **Event system**: Event stream for real-time monitoring
- **Flexible configuration**: Multiple configuration options
- **Logging system**: Detailed logs for debugging and monitoring
- **Full example**: Demo app with monitoring interface
- **Complete documentation**: Detailed README with examples

### 🏗️ Architecture
- **HeatmapTracker**: Main singleton class for management
- **HeatmapConfig**: Type-safe configuration system
- **HeatmapSession**: Session management with metadata
- **HeatmapModels**: Models for positions, clicks, and trails
- **HeatmapUtils**: Utilities for storage, URLs, and data manipulation

### 📦 Initial Release
- Complete Flutter library for heatmap tracking
- Conversion of the original JavaScript system to Dart
- Clean and well-documented API
- Functional usage example
- Compatibility with existing Node.js server