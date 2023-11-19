import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

// Create an HTTP link that connects to the Apollo Server instance.
// The URI should match the one provided by your Apollo Server setup.
const httpLink = new HttpLink({
  uri: 'http://localhost:4000/graphql', // Adjust the port if necessary
});

// Instantiate the Apollo Client with the created link and a new instance of InMemoryCache.
const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

export default client;
