import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

const graphqlUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql';

const httpLink = createHttpLink({
  uri: graphqlUrl,
  fetchOptions: {
    mode: 'cors',
  },
});

// Error handling link
const errorLink = onError((error: any) => {
  if (error.graphQLErrors) {
    error.graphQLErrors.forEach((err: any) => {
      console.error(
        `[GraphQL error]: Message: ${err.message}, Location: ${err.locations}, Path: ${err.path}`
      );
    });
  }

  if (error.networkError) {
    console.error(`[Network error]: ${error.networkError}`);
    if (error.networkError.statusCode === 404) {
      console.warn(`GraphQL endpoint not found at ${graphqlUrl}. The API may not be available.`);
    }
    // Don't throw - let the component handle the error gracefully
  }
});

console.log('Apollo Client URI:', process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql');

export const apolloClient = new ApolloClient({
  link: from([errorLink, httpLink]),
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
