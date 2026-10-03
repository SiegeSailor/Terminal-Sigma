# Terminal-Sigma

[![NPM version](https://img.shields.io/npm/v/%40siegesailor/terminal-sigma?logo=npm)](https://www.npmjs.com/package/@siegesailor/terminal-sigma)
[![test pipeline status](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/test.yml)

Terminal-Sigma is a terminal-based application that provides gaming visual feedback based the progress of the self-development journey. Through it is a CLI, it is meant to be long-running for real-time updates and interactions without commands but operable terminal UIs. It features a few main components:

- **Character Progression**: Visualizes the user's growth and development through an animated character
- **Tomato Timer**:
- **Diet Tracker**:
- **Workout Tracker**:
- **Everyday Quotes**:

Underneath, the user's journey is written into a local file `progress.json`, which resides in the same directory as the application. There is no plan to support logging at this point, and we chose the readable format JSON for the user to easily port.

## Installation

The package is available on NPM:

```shell
npm install @siegesailor/terminal-sigma
```

### Prerequisites

Required software for this module:

- [Node.js](https://nodejs.org/): `>= 25.2.1`
