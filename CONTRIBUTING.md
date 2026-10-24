# Contributing to Graphium

Thank you for considering contributing to Graphium! We welcome contributions from the community.

## How to Contribute

### Reporting Issues
- Use the GitHub issue tracker to report bugs or request features
- Please include as much detail as possible, including:
  - Steps to reproduce the issue
  - Expected vs actual behavior
  - Browser and version information
  - Screenshots or screen recordings if applicable

### Pull Requests
1. Fork the repository
2. Create a new branch for your feature or bugfix
3. Make your changes
4. Ensure your code follows the existing style and conventions
5. Add or update tests as needed
6. Submit a pull request with a clear description of your changes

## Development Setup

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn
- Git

### Getting Started
```bash
# Clone the repository
git clone https://github.com/yourusername/Graphium.git
cd Graphium

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build
```

### Project Structure
```
Graphium/
├── src/                 # Source code
│   ├── core/            # Graph model and data structures
│   ├── physics/         # Physics engine components
│   ├── render/          # WebGL rendering system
│   ├── interaction/     # User interaction handling
│   └── Graphium.js      # Main facade class
├── examples/            # Usage examples
├── docs/                # Documentation files
└── test/                # Test files
```

### Coding Standards
- Follow the existing code style in the repository
- Write clear, descriptive commit messages
- Add JSDoc comments for new or modified public APIs
- Keep functions focused and single-purpose
- Prefer small, composable functions over large monolithic ones

### Testing
- We use Jest for unit testing
- Add tests for new features and bug fixes
- Ensure all tests pass before submitting a PR
- Test both typical usage and edge cases

## Community
- Please be respectful and constructive in all interactions
- Help others when you can
- Follow the project's Code of Conduct (TODO: add)

## License
By contributing to Graphium, you agree that your contributions will be licensed under the MIT License.