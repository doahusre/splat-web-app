import React from 'react';
import { createRoot } from 'react-dom';

import './index.css';
import App from './App';
import { ApolloProvider } from '@apollo/client';
import client from './apolloClient'; // Adjust the path as per your project structure

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);
