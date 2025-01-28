# Project Overview: Transcendence

## Introduction

Transcendence is an app that reimagines the classic Pong game with modern web technologies and multiplayer capabilities. The project combines real-time gaming, AI opponent and social features to create an engaging multiplayer experience.

### Key Goals
- Single player mode against trained AI
- Real-time multiplayer gaming and tournament mode
- Scalable architecture for game state management
- Responsive user interface with component reactivity
- Social interactions through chat and game invitations

### Technical Highlights
- Full-stack Python Django / vanilla Javascript implementation
- Real-time WebSocket communication for room state and chat
- Peer-ro-peer real-time game state management
- Custom state management and UI rendering system
- Comprehensive security measures and user authentication
- Containerized development and deployment with Docker

## Key Features
1. **Real-time Gaming & Communication**:
   - Room-based websocket multiplayer system
   - Webrtc-based game state synchronization
   - Game settings customization
   - Websocket-based chat functionality

2. **Modern Frontend Architecture & State Management**:
   - Component-based UI system
   - Custom dynamic rendering capabilities
   - State synchronization between client and server
   - Room state management
   - UI state handling

3. **Gaming Features**:
   - Pong game implementation
   - Room-based multiplayer system
   - Game state management
   - AI components

4. **Development Experience & Security**:
   - Docker-based development environment
   - Hot reloading support
   - Comprehensive testing setup
   - JWT-based authentication
   - Environment-based configuration
   - CORS handling

5. **User Management**:
   - Authentication system
   - User profiles
   - Media handling

### Backend
- **Framework**: Django (Python-based)
- **Key Components**:
  - Django REST Framework for API endpoints
  - Channels for WebSocket support
  - Daphne as the ASGI server
  - PostgreSQL database
  - Authentication using JWT

### Frontend
- **Technology Stack**:
  - Modern JavaScript (ES modules)
  - HTMX for dynamic HTML updates
  - Bootstrap 5 for styling
  - Custom UI components and state management
  - WebGL support

## Development Environment
- **Build System**: 
  - esbuild for frontend bundling
  - Docker and Docker Compose for containerization
  - Make-based dev and build automation

- **Testing**:
  - Jest for frontend testing
  - Comprehensive test coverage setup
  - Dynamic rendering test utilities

## Project Structure
```
├── transcendence/		# Main Django project
│   ├── frontend/			# Vanilla JavaScript frontend
│   │   ├── UI/				# User interface components
│   │   ├── room/				# Room management
│   │   ├── state/			# State management
│   │   ├── pong/				# Game logic
│   │   └── chat/				# Chat module
│   └── static/				# Static assets
├── templates/			# Django HTML templates with vue-like directives
├── authentication/	# Authentication module
├── pong/				# Game backend
├── ai/					# AI opponent traning module
└── chat/				# Chat backend
```

## Development Principles
1. Type safety first
2. Comprehensive error handling
3. Clean architecture with abstraction layers
4. Test-driven development
5. Documentation as code
6. Model-agnostic design 
