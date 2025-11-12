import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
  fetchOptions: {
    mode: 'cors',
  },
});

console.log('Apollo Client URI:', process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql');

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
      fetchPolicy: 'network-only',
    },
    query: {
      errorPolicy: 'all',
      fetchPolicy: 'network-only',
    },
  },
});
