# GaussianSplats3D Web Application

The GaussianSplats3D Web Application uses GraphQL server with a React-based client interface. This application leverages the renderer provided by the GaussianSplats3D library, which can be found at [GaussianSplats3D GitHub Repository](https://github.com/mkkellogg/GaussianSplats3D.git).

## Prerequisites

Before setting up the project, ensure that you have the following installed:
- Node.js (latest stable version)
- npm (Node Package Manager)

## Getting Started

Follow these steps to set up the project environment:

1. **Install Project Dependencies:**
   Navigate to the project's root directory and execute:
   ```
   npm install
   ```

2. **Install Client and Server Dependencies:**
   ```
   npm run install-deps
   ```

3. **Download Required Data:**
   ```
   npm run download-data
   ```
   This will download necessary data files and place them in the appropriate server directory.

4. **Start the Application:**
   ```
   npm start
   ```
   This will launch both the server and client. The project should now be running and accessible via: [http://localhost:3000](http://localhost:3000)

## Controls

Mouse
- Left click to set the focal point
- Left click and drag to orbit around the focal point
- Right click and drag to pan the camera and focal point
  
Keyboard
- `C` Toggles the mesh cursor, showing the intersection point of a mouse-projected ray and the splat mesh

- `I` Toggles an info panel that displays debugging info:
  - Camera position
  - Camera focal point/look-at point
  - Camera up vector
  - Mesh cursor position
  - Current FPS
  - Renderer window size
  - Ratio of rendered splats to total splats
  - Last splat sort duration

- `P` Toggles a debug object that shows the orientation of the camera controls. It includes a green arrow representing the camera's orbital axis and a white square representing the plane at which the camera's elevation angle is 0.

- `Left arrow` Rotate the camera's up vector counter-clockwise

- `Right arrow` Rotate the camera's up vector clockwise