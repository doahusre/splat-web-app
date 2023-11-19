import React, { useEffect, useRef } from 'react';
import { useQuery, gql } from '@apollo/client';
import { Viewer } from './GaussianSplats3D/build/gaussian-splats-3d.module.js';

const GET_SPLAT_FILE = gql`
  query getSplatFile {
    getSplatFile
  }
`;

function ViewerComponent() {
  const viewerContainerRef = useRef(null);
  const { loading, error, data } = useQuery(GET_SPLAT_FILE);

  useEffect(() => {
    if (data && !loading && !error) {
      const base64ToArrayBuffer = (base64Data) => {
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      };

      const arrayBuffer = base64ToArrayBuffer(data.getSplatFile);

      const viewer = new Viewer({
        rootElement: viewerContainerRef.current,
        cameraUp: [0, -1, -0.54],
        initialCameraPosition: [-3.15634, -0.16946, -0.51552],
        initialCameraLookAt: [1.52976, 2.27776, 1.65898],
      });
      viewer.init();
      viewer.loadFile(arrayBuffer, {
        halfPrecisionCovariancesOnGPU: true,
      })
      .then(() => {
        viewer.start();
      })
      .catch((e) => {
        console.error("Error starting viewer:", e);
      });
    }
  }, [data, loading, error, viewerContainerRef]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return <div id="viewer-container" ref={viewerContainerRef} style={{ width: '100%', height: '100vh' }} />;
}

export default ViewerComponent;
