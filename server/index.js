const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const fs = require('fs');
const http = require('http'); // Using http instead of https
const path = require('path');
const { ApolloServerPluginLandingPageGraphQLPlayground } = require('apollo-server-core');

const app = express();

// Set security headers
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../client/public')));

const typeDefs = gql`
  type Query {
    getSplatFile: String
  }
`;

const resolvers = {
  Query: {
    getSplatFile: () => {
      try {
        const filePath = path.join(__dirname, 'data/garden/garden_high.splat');
        const fileBuffer = fs.readFileSync(filePath);
        const base64String = fileBuffer.toString('base64');
        return base64String;
      } catch (error) {
        console.error('Error reading splat file:', error);
        throw new Error('Failed to read the splat file.');
      }
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
});

async function startServer() {
  await server.start();
  server.applyMiddleware({ app });

  // Create HTTP server
  const httpServer = http.createServer(app);

  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 HTTP Server is running on http://localhost:${PORT}${server.graphqlPath}`);
  });
}

startServer();
